import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { BaseComponent } from './base/base.component';
import { LoadingGuard } from '@common/loading-guard';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ImageListComponent } from './image/image-list/image-list.component';
import { ImageCropperComponent } from './image/image-cropper/image-cropper.component';

const routes: Routes = [{
    path: '', component: BaseComponent, canActivate: [LoadingGuard], children: [
        { path: '', component: DashboardComponent },
        { path: 'video', component: ImageListComponent },
        { path: 'image', component: ImageCropperComponent },
    ]
}];

@NgModule({
    imports: [RouterModule.forRoot(routes, { 
        useHash: true,
        scrollPositionRestoration: 'top',
        relativeLinkResolution: 'legacy' 
    })],
    exports: [RouterModule]
})
export class AppRoutingModule { }
