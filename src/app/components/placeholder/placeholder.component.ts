import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

/**
 * PLACEHOLDER COMPONENT
 * Component tạm thời cho các route chưa được triển khai
 */
@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="placeholder-container">
      <div class="placeholder-content">
        <div class="placeholder-icon">
          <i class="fa-solid fa-hammer"></i>
        </div>
        <h2 class="placeholder-title">{{ title }}</h2>
        <p class="placeholder-message">
          Tính năng này đang được phát triển.
        </p>
        <div class="placeholder-info">
          <p><strong>Module:</strong> {{ module }}</p>
          <p><strong>Dự kiến:</strong> Sẽ được triển khai trong phiên bản tiếp theo</p>
        </div>
        <a routerLink="/accountant/dashboard" class="placeholder-back">
          <i class="fa-solid fa-arrow-left"></i>
          Quay lại Dashboard
        </a>
      </div>
    </div>
  `,
  styles: [`
    .placeholder-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      padding: 2rem;
    }

    .placeholder-content {
      text-align: center;
      max-width: 500px;
    }

    .placeholder-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .placeholder-icon i {
      font-size: 2rem;
      color: #d97706;
    }

    .placeholder-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 0.75rem;
    }

    .placeholder-message {
      font-size: 1rem;
      color: #6b7280;
      margin: 0 0 1.5rem;
    }

    .placeholder-info {
      background: #f9fafb;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      text-align: left;
    }

    .placeholder-info p {
      margin: 0.5rem 0;
      font-size: 0.875rem;
      color: #4b5563;
    }

    .placeholder-info strong {
      color: #1f2937;
    }

    .placeholder-back {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: #3b82f6;
      color: white;
      border-radius: 8px;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: background 0.2s;
    }

    .placeholder-back:hover {
      background: #2563eb;
    }
  `]
})
export class PlaceholderComponent implements OnInit {
  title: string = 'Tính năng đang phát triển';
  module: string = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.title = data['title'] || 'Tính năng đang phát triển';
      this.module = data['module'] || '';
    });
  }
}
