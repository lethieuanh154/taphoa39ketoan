import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HddtTokenDialogComponent } from './components/shared/hddt-token-dialog/hddt-token-dialog.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HddtTokenDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'TapHoa39KeToan';

  onTokenSaved(token: string): void {
    console.log('HDDT Token saved successfully');
  }
}
