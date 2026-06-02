import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UserAvatarComponent } from './user-avatar.component';

describe('UserAvatarComponent', () => {
  let fixture: ComponentFixture<UserAvatarComponent>;
  let component: UserAvatarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserAvatarComponent],
      providers: [provideRouter([])]
    }).compileComponents();
    fixture = TestBed.createComponent(UserAvatarComponent);
    component = fixture.componentInstance;
  });

  it('renderiza una imagen cuando avatar es una URL http(s)', () => {
    component.avatar = 'https://example.com/me.png';
    component.name = 'Alice';
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toContain('me.png');
  });

  it('renderiza iniciales cuando avatar es texto corto', () => {
    component.avatar = '';
    component.name = 'Alice Bob';
    fixture.detectChanges();
    expect(component.initials()).toBe('AB');
  });

  it('envuelve en router-link cuando linkToProfile y userId estan presentes', () => {
    component.linkToProfile = true;
    component.userId = 'u-1';
    component.name = 'A';
    fixture.detectChanges();
    expect(component.linkTarget()).toEqual(['/tabs/profile', 'u-1']);
  });

  it('no envuelve en link si falta userId aunque linkToProfile sea true', () => {
    component.linkToProfile = true;
    component.userId = null;
    fixture.detectChanges();
    expect(component.linkTarget()).toBeNull();
  });
});
