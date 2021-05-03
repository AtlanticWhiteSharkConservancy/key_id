import { CanActivate } from '@angular/router';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { of as ObservableOf } from 'rxjs';
import { StateService } from '@services/state.service';
import { Subject } from 'rxjs';

@Injectable()
export class LoadingGuard implements CanActivate {
    constructor(private state: StateService) {}

    public canActivate(): Observable<boolean> {
        if (!this.state.loading$.getValue()) { return ObservableOf(true); }

        let subject = new Subject<boolean>();
        let subscription = this.state.loading$.subscribe(value => {
            if (!value) {
                subject.next(true);
                subject.complete();
                subscription.unsubscribe();
            }
        });

        return subject;
    }
}
