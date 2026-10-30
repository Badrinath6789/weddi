import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'weddi';

  isVisible = true;

  closePopup() {
    this.isVisible = false;
  }
}
