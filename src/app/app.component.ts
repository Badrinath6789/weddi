import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/* ------------------------------------------------------------------
   EDIT THESE DETAILS  (date, venue and address are placeholders)
------------------------------------------------------------------- */
const CONFIG = {
  groom: 'SaiShashank',
  bride: 'Kavya',
  // ISO date with India time zone (+05:30). Change to the real muhurtham time.
  weddingDateISO: '2026-11-25T10:14:00+05:30',
  durationHours: 5,
  venueName: 'Sri Gardens',
  addressLines: ['Medchal,Secundrabad'],
  // Used for the map + directions. Full address text works; lat,lng also works.
  mapQuery: 'Sri Gardens, Medchal, Secundrabad',
  eventTitle: 'Wedding of Saishashank & Kavya',
  eventDescription: 'With the blessings of elders, we invite you to the wedding of Saishashank & Kavya.'
};

interface Petal { left: number; size: number; delay: number; dur: number; sway: number; hue: number; }

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('music') musicRef!: ElementRef<HTMLAudioElement>;

  cfg = CONFIG;
  weddingDate = new Date(CONFIG.weddingDateISO);

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

  ngOnInit(): void {
    const q = encodeURIComponent(CONFIG.mapQuery);
    this.mapUrl = this.san.bypassSecurityTrustResourceUrl(`https://www.google.com/maps?q=${q}&output=embed`);
    this.directionsUrl = `https://maps.app.goo.gl/WzFa8iUH2VPwZvQ6A`;

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

  enter(): void {
    this.opened = true;
    this.playMusic();
    setTimeout(() => (this.gateGone = true), 2400);
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