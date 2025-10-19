import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayersList } from './players-list';

describe('PlayersList', () => {
  let component: PlayersList;
  let fixture: ComponentFixture<PlayersList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayersList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayersList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
