import { Component } from '@angular/core';
import { StateService } from '@services/state.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-base',
    templateUrl: './base.component.html',
    styleUrls: ['./base.component.scss']
})
export class BaseComponent {
    constructor(private state: StateService, private router: Router) {}
}
