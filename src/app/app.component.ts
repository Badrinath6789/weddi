import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/* ------------------------------------------------------------------
   EDIT THESE DETAILS  (date, venue and address are placeholders)
------------------------------------------------------------------- */
const CONFIG = {
  groom: 'Saishashank',
  bride: 'Kavya',
  // ISO date with India time zone (+05:30). Change to the real muhurtham time.
  weddingDateISO: '2026-11-25T10:14:00+05:30',
  durationHours: 5,
  venueName: 'Sri Gardens',
  addressLines: ['Medchal', 'Secunderabad'],
  // EXACT pin for the embedded map (and its "Open in Maps" link). A plain name search shows lookalike
  // venues, so use the plus code of the correct place, or its coordinates like '17.5123,78.4567'.
  mapPin: 'JFPR+34R Medchal, Telangana',
  // Fallback text search, only used if mapPin is ''.
  mapQuery: 'Sri Gardens, Medchal, Secunderabad',
  // Get Directions button: your Google Maps share link of the correct place.
  directionsLink: 'https://maps.app.goo.gl/ojq8tHiEHh1auKTd8?g_st=aw',
  eventTitle: 'Wedding of Saishashank & Kavya',
  eventDescription: 'With the blessings of elders, we invite you to the wedding of Saishashank & Kavya.',
  liveUrl: 'https://www.youtube.com/live/qPUT0mh-_IE',
  liveNote: 'Can\'t join us in person? Watch the muhurtham live from wherever you are.',
  // Door theme shown first: 1 = Royal Palace, 2 = Floral Garden, 3 = Traditional Heritage
  defaultTheme: 1
};

export type ThemeId = 1 | 2 | 3;

interface ThemeInfo { id: ThemeId; short: string; full: string; icon: string; }
interface Petal { left: number; size: number; delay: number; dur: number; sway: number; hue: number; }
interface Deco { x: number; y: number; s: number; c: number; r: number; }
interface Burst { dx: number; dy: number; s: number; c: number; d: number; r: number; }

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('music') musicRef!: ElementRef<HTMLAudioElement>;

  cfg = CONFIG;
  weddingDate = new Date(CONFIG.weddingDateISO);

  /* ---------- door themes ---------- */
  themes: ThemeInfo[] = [
    { id: 1, short: 'Royal',    full: '',icon: '\u265B' },
    { id: 2, short: 'Floral',   full: '',icon: '\u2740' },
    { id: 3, short: 'Heritage', full: '',icon: '\u2738' }
  ];
  theme: ThemeId = CONFIG.defaultTheme as ThemeId;
  switching = false;

  /** flowers / leaves that cover each door in the Floral Garden theme (x in px from outer edge, y in % of height) */
  flowerDeco: Deco[] = [
    { x: -20, y: -3,  s: 96,  c: 0, r: 10 },
    { x: 34,  y: 3,   s: 54,  c: 1, r: -15 },
    { x: -28, y: 24,  s: 76,  c: 1, r: -20 },
    { x: 26,  y: 40,  s: 46,  c: 2, r: 25 },
    { x: -16, y: 52,  s: 90,  c: 2, r: 30 },
    { x: 30,  y: 70,  s: 52,  c: 0, r: -10 },
    { x: -22, y: 80,  s: 108, c: 0, r: -10 },
    { x: 40,  y: 90,  s: 64,  c: 1, r: 20 }
  ];
  leafDeco: Deco[] = [
    { x: 4,   y: 12,  s: 70, c: 0, r: 40 },
    { x: 46,  y: 18,  s: 56, c: 1, r: -35 },
    { x: -6,  y: 38,  s: 74, c: 1, r: -55 },
    { x: 44,  y: 54,  s: 60, c: 0, r: 50 },
    { x: 6,   y: 66,  s: 72, c: 0, r: 25 },
    { x: 48,  y: 82,  s: 58, c: 1, r: -40 }
  ];
  /** hanging mango-leaf & marigold toran (Heritage theme) */
  toranItems = Array.from({ length: 9 }, (_, i) => i);
  /** petals that burst out when the Floral Garden doors open */
  burst: Burst[] = [];

  opened = false;      // gate clicked
  gateGone = false;    // gate removed from DOM after animation
  playing = false;
  musicMissing = false;

  days = 0; hours = 0; minutes = 0; seconds = 0;
  started = false;     // countdown reached zero

  petals: Petal[] = [];
  mapUrl!: SafeResourceUrl;
  directionsUrl = '';
  googleCalUrl = '';

  private timer?: number;
  private observer?: IntersectionObserver;

  constructor(private san: DomSanitizer, private zone: NgZone, private host: ElementRef<HTMLElement>) {}

  get currentTheme(): ThemeInfo {
    return this.themes.find(t => t.id === this.theme) || this.themes[0];
  }

  ngOnInit(): void {
    const q = encodeURIComponent(CONFIG.mapPin || CONFIG.mapQuery);
    this.mapUrl = this.san.bypassSecurityTrustResourceUrl(`https://www.google.com/maps?q=${q}&output=embed`);
    this.directionsUrl = CONFIG.directionsLink || `https://www.google.com/maps/dir/?api=1&destination=${q}`;

    const start = this.weddingDate;
    const end = new Date(start.getTime() + CONFIG.durationHours * 3600 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    this.googleCalUrl =
      'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(CONFIG.eventTitle)}` +
      `&dates=${fmt(start)}/${fmt(end)}` +
      `&details=${encodeURIComponent(CONFIG.eventDescription)}` +
      `&location=${encodeURIComponent(CONFIG.venueName + ', ' + CONFIG.addressLines.join(', '))}`;

    this.petals = Array.from({ length: 16 }, () => ({
      left: Math.random() * 100,
      size: 14 + Math.random() * 18,
      delay: Math.random() * 12,
      dur: 9 + Math.random() * 8,
      sway: 20 + Math.random() * 50,
      hue: Math.floor(Math.random() * 3)
    }));

    this.burst = Array.from({ length: 26 }, (_, i) => {
      const ang = (i / 26) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 38 + Math.random() * 55; // vw-ish distance
      return {
        dx: Math.round(Math.cos(ang) * dist),
        dy: Math.round(Math.sin(ang) * dist * 1.1),
        s: 16 + Math.random() * 22,
        c: Math.floor(Math.random() * 3),
        d: Math.random() * 0.35,
        r: Math.round(Math.random() * 540 - 270)
      };
    });

    this.tick();
    // run the clock outside Angular's zone, update only when value changes
    this.zone.runOutsideAngular(() => {
      this.timer = window.setInterval(() => this.zone.run(() => this.tick()), 1000);
    });
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); this.observer?.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    this.host.nativeElement.querySelectorAll('.reveal').forEach(el => this.observer!.observe(el));
  }

  ngOnDestroy(): void {
    if (this.timer) { clearInterval(this.timer); }
    this.observer?.disconnect();
  }

  private tick(): void {
    const diff = this.weddingDate.getTime() - Date.now();
    if (diff <= 0) {
      this.started = true;
      this.days = this.hours = this.minutes = this.seconds = 0;
      return;
    }
    this.started = false;
    const s = Math.floor(diff / 1000);
    this.days = Math.floor(s / 86400);
    this.hours = Math.floor((s % 86400) / 3600);
    this.minutes = Math.floor((s % 3600) / 60);
    this.seconds = s % 60;
  }

  pad(n: number): string { return n < 10 ? '0' + n : '' + n; }

  /** Switch the opening-door theme (only before the invitation is opened) */
  setTheme(id: ThemeId): void {
    if (this.opened || id === this.theme || this.switching) { return; }
    this.switching = true;                       // quick fade-out
    setTimeout(() => {
      this.theme = id;                           // swap while hidden
      setTimeout(() => (this.switching = false), 30); // fade-in
    }, 230);
  }

  enter(): void {
    if (this.opened) { return; }
    this.opened = true;
    this.playMusic();
    setTimeout(() => (this.gateGone = true), 3000);
  }

  playMusic(): void {
    const a = this.musicRef?.nativeElement;
    if (!a) { return; }
    a.volume = 0.6;
    a.play().then(() => (this.playing = true)).catch(() => { this.playing = false; });
  }

  toggleMusic(): void {
    const a = this.musicRef.nativeElement;
    if (a.paused) { this.playMusic(); } else { a.pause(); this.playing = false; }
  }

  onMusicError(): void { this.musicMissing = true; this.playing = false; }

  /** Downloads an .ics file (works with Apple / Outlook / Android calendars) */
  downloadIcs(): void {
    const start = this.weddingDate;
    const end = new Date(start.getTime() + CONFIG.durationHours * 3600 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = (t: string) => t.replace(/,/g, '\\,').replace(/;/g, '\\;');
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Weddi//Invitation//EN', 'BEGIN:VEVENT',
      `UID:${start.getTime()}@weddi`, `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
      `SUMMARY:${esc(CONFIG.eventTitle)}`,
      `DESCRIPTION:${esc(CONFIG.eventDescription)}`,
      `LOCATION:${esc(CONFIG.venueName + ', ' + CONFIG.addressLines.join(', '))}`,
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Wedding tomorrow', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Saishashank-Kavya-Wedding.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}