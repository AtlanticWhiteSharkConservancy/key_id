import { ActivatedRouteSnapshot, CanActivateChild } from '@angular/router';
import { CanActivate } from '@angular/router';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { RouterStateSnapshot } from '@angular/router';
import { StateService } from './state.service';

@Injectable()
export class AuthGuard implements CanActivate, CanActivateChild {
    constructor(private state: StateService, private router: Router) { }

    public canActivate(route: ActivatedRouteSnapshot, router: RouterStateSnapshot): boolean {
        return this.state.updateLoggedInState(router.url);
    }

    public canActivateChild(route: ActivatedRouteSnapshot, router: RouterStateSnapshot): boolean {
        return this.state.updateLoggedInState(router.url);
    }
}
