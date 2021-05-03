import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SimpleNotificationsModule } from 'angular2-notifications';
import { StateService } from '@services/state.service';
import { AppService } from '@services/app/app.service';
import { AuthService } from '@services/auth.service';
import { BaseComponent } from './base/base.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { HttpClientModule } from '@angular/common/http';
import { LoadingGuard } from '@common/loading-guard';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ImageListComponent } from './image/image-list/image-list.component';
import { ImageCropperComponent } from './image/image-cropper/image-cropper.component';
import { SliderModule } from 'primeng/slider';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';

@NgModule({
    declarations: [
        AppComponent,
        BaseComponent,
        DashboardComponent,
        ImageListComponent,
        ImageCropperComponent,
    ],
    imports: [
        AppRoutingModule,
        BrowserModule,
        CheckboxModule,
        FormsModule,
        HttpClientModule,
        NoopAnimationsModule,
        SimpleNotificationsModule.forRoot(),
        SliderModule,
    ],
    providers: [
        AppService,
        AuthService,
        LoadingGuard,
        StateService,
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
