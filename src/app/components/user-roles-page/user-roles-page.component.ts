import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastLogin?: Date;
  createdAt: Date;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
}

@Component({
  selector: 'app-user-roles-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-roles-page.component.html',
  styleUrl: './user-roles-page.component.css'
})
export class UserRolesPageComponent implements OnInit {
  users: User[] = [];
  roles: Role[] = [];
  activeTab: 'users' | 'roles' = 'users';
  showUserModal = false;
  showRoleModal = false;
  editingUser: Partial<User> = {};
  editingRole: Partial<Role> = {};

  permissionGroups = [
    { name: 'Danh mục', permissions: ['Xem danh mục', 'Thêm/sửa danh mục', 'Xóa danh mục'] },
    { name: 'Chứng từ', permissions: ['Xem chứng từ', 'Tạo chứng từ', 'Duyệt chứng từ', 'Hủy chứng từ'] },
    { name: 'Báo cáo', permissions: ['Xem báo cáo tài chính', 'Xem báo cáo quản trị', 'Xuất báo cáo'] },
    { name: 'Hệ thống', permissions: ['Quản lý người dùng', 'Cài đặt hệ thống', 'Khóa sổ'] }
  ];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.roles = [
      { id: 'R001', name: 'Quản trị viên', description: 'Toàn quyền trên hệ thống', permissions: ['all'], userCount: 1 },
      { id: 'R002', name: 'Kế toán trưởng', description: 'Quản lý kế toán, duyệt chứng từ', permissions: ['view', 'create', 'approve', 'reports'], userCount: 1 },
      { id: 'R003', name: 'Kế toán viên', description: 'Nhập liệu, lập chứng từ', permissions: ['view', 'create'], userCount: 2 },
      { id: 'R004', name: 'Xem báo cáo', description: 'Chỉ xem báo cáo', permissions: ['view_reports'], userCount: 1 }
    ];

    this.users = [
      { id: 'U001', username: 'admin', fullName: 'Administrator', email: 'admin@taphoa39.vn', role: 'Quản trị viên', status: 'ACTIVE', lastLogin: new Date(), createdAt: new Date(2024, 0, 1) },
      { id: 'U002', username: 'ketoan01', fullName: 'Nguyễn Văn An', email: 'an@taphoa39.vn', role: 'Kế toán trưởng', status: 'ACTIVE', lastLogin: new Date(), createdAt: new Date(2024, 0, 15) },
      { id: 'U003', username: 'ketoan02', fullName: 'Trần Thị Bích', email: 'bich@taphoa39.vn', role: 'Kế toán viên', status: 'ACTIVE', lastLogin: new Date(2025, 0, 20), createdAt: new Date(2024, 2, 1) },
      { id: 'U004', username: 'ketoan03', fullName: 'Lê Văn Cường', email: 'cuong@taphoa39.vn', role: 'Kế toán viên', status: 'ACTIVE', createdAt: new Date(2024, 5, 1) },
      { id: 'U005', username: 'giamdoc', fullName: 'Phạm Thị Dung', email: 'dung@taphoa39.vn', role: 'Xem báo cáo', status: 'ACTIVE', lastLogin: new Date(2025, 0, 15), createdAt: new Date(2024, 0, 1) }
    ];
  }

  openUserModal(user?: User): void {
    this.editingUser = user ? { ...user } : { status: 'ACTIVE' };
    this.showUserModal = true;
  }

  closeUserModal(): void {
    this.showUserModal = false;
    this.editingUser = {};
  }

  saveUser(): void {
    alert('Lưu người dùng: ' + this.editingUser.fullName);
    this.closeUserModal();
  }

  openRoleModal(role?: Role): void {
    this.editingRole = role ? { ...role } : { permissions: [] };
    this.showRoleModal = true;
  }

  closeRoleModal(): void {
    this.showRoleModal = false;
    this.editingRole = {};
  }

  saveRole(): void {
    alert('Lưu vai trò: ' + this.editingRole.name);
    this.closeRoleModal();
  }

  formatDate(date: Date | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('vi-VN');
  }

  getStatusLabel(status: string): string {
    return status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng HĐ';
  }

  getStatusClass(status: string): string {
    return status === 'ACTIVE' ? 'status-active' : 'status-inactive';
  }
}
