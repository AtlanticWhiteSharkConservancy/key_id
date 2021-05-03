import { Component, ViewChild, ElementRef } from '@angular/core';
import { OnInit } from '@angular/core';
import { StateService } from '@services/state.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
    public loading: boolean = true;

    public notificationsOptions: any = {
        position: ['bottom', 'right'],
        pauseOnHover: true,
        timeOut: 15000,
    };

    @ViewChild('clipboardTarget', { static: true })
    public clipboardTarget: ElementRef;

    constructor(private state: StateService) { }

    public ngOnInit() {
        this.state.loading$.subscribe(value => {
            this.loading = value;
        });
    }
}
