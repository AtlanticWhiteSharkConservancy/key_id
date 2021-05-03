import { Component, Input } from "@angular/core";

@Component({
    selector: 'app-loading-indicator',
    template: `
    <div class="loading-indicator">
        <p-progressSpinner animationDuration="1s" [styleClass]="size" [strokeWidth]="4"></p-progressSpinner>
    </div>`,
    styleUrls: ['./loading-indicator.component.scss']
})
export class LoadingIndicatorComponent {

    @Input()
    size: string = '';
}
