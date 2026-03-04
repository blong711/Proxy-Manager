# BÁO CÁO TỔNG QUAN: CHỨC NĂNG HỆ THỐNG PROXY MANAGER

## 1. Giới thiệu Tổng quan
**Proxy Manager** là hệ thống phần mềm quản lý tập trung tài nguyên mạng, bao gồm Proxy, Nhà cung cấp (Providers) và Tài khoản (Accounts). Hệ thống được thiết kế để thay thế quy trình quản lý dữ liệu thủ công qua bảng tính (như Google Sheets/Excel), cung cấp khả năng tự động hóa kiểm tra trạng thái và cung cấp giao thức kết nối API cho các ứng dụng bên thứ ba.

## 2. Các tính năng cốt lõi (Core Features)

Hệ thống được phát triển với các nhóm tính năng chính sau:

*   **Bảng Điều Khiển (Dashboard):** Hiển thị các số liệu thống kê tổng quan theo thời gian thực:
    *   Tổng số lượng Proxy trong hệ thống.
    *   Phân loại trạng thái Proxy: Đang hoạt động (Live) / Không hoạt động (Die).
    *   Thống kê số lượng Nhà cung cấp và Tài khoản.
*   **Quản lý Dữ liệu Phân cấp (Hierarchical Data Management):** Tổ chức dữ liệu theo cấu trúc quan hệ:
    *   *Quản lý Nhà cung cấp (Providers):* Lưu trữ thông tin đơn vị cung cấp dịch vụ proxy.
    *   *Quản lý Tài khoản (Accounts):* Quản lý các tài khoản người dùng đã đăng ký tại từng nhà cung cấp.
    *   *Quản lý Proxy:* Quản lý danh sách IP/Port proxy, được map (gắn kết) trực tiếp với tài khoản và nhà cung cấp tương ứng.
*   **Tự động Kiểm tra Trạng thái (Automated Proxy Checker):** Hệ thống tích hợp module chạy ngầm để thực hiện lệnh kiểm tra (ping) định kỳ đối với toàn bộ danh sách Proxy, qua đó cập nhật trạng thái kết nối (Live/Die) tự động.
*   **Tích hợp API (API Integration):** Cung cấp các endpoint RESTful API. Chức năng này cho phép các phần mềm, công cụ bên ngoài (Automation Tools, Bots) truy xuất trực tiếp danh sách proxy khả dụng mà không cần thao tác thủ công.
*   **Phân quyền Truy cập (Role-Based Access Control - RBAC):** 
    *   Yêu cầu xác thực tài khoản/mật khẩu để truy cập hệ thống.
    *   Phân chia hai cấp độ người dùng: **Admin** (Toàn quyền quản trị, thêm/sửa/xóa dữ liệu) và **User** (Quyền xem hiển thị dữ liệu).

---

## 3. Đánh giá tính Chuyển đổi: Proxy Manager App so với Google Sheets / Excel

Việc thay thế quy trình sử dụng Google Sheets/Excel bằng Hệ thống Proxy Manager mang lại các thay đổi cụ thể về mặt nghiệp vụ như sau:

### 3.1. Điểm Khác biệt & Lợi thế
1.  **Mức độ Tự động hóa nghiệp vụ:**
    *   *Google Sheets:* Yêu cầu nhân sự sử dụng công cụ bên ngoài để kiểm tra trạng thái proxy, sau đó nhập/cập nhật kết quả thủ công vào bảng tính.
    *   *Proxy Manager:* Việc định tuyến và kiểm tra trạng thái (Live/Die) được thực hiện tự động bởi hệ thống ngầm định.
2.  **Khả năng Cung cấp Dữ liệu (Interoperability):**
    *   *Google Sheets:* Việc trích xuất dữ liệu cho các phần mềm tự động hóa khác gặp khó khăn về mặt giao thức và cập nhật thời gian thực.
    *   *Proxy Manager:* Hỗ trợ xuất dữ liệu qua API, các hệ thống ngoài có thể lấy dữ liệu proxy trạng thái "Live" một cách tự động.
3.  **Xử lý Khối lượng Dữ liệu:**
    *   *Google Sheets:* Gặp giới hạn về hiệu năng thao tác (tìm kiếm, lọc dữ liệu) khi số lượng bản ghi lớn (trên 5.000 - 10.000 dòng).
    *   *Proxy Manager:* Sử dụng cơ sở dữ liệu chuyên dụng, hỗ trợ phân trang (Pagination), đảm bảo hiệu năng ổn định khi xử lý số lượng dữ liệu lớn.
4.  **Bảo mật Thông tin & Kiểm soát:**
    *   *Google Sheets:* Rủi ro rò rỉ dữ liệu qua việc chia sẻ link URL. Khó kiểm soát việc sao chép hoặc xóa nhầm toàn bộ dữ liệu.
    *   *Proxy Manager:* Quản lý truy cập bằng Database User riêng biệt. Các hành động Sửa/Xóa dữ liệu bị giới hạn nghiêm ngặt theo phân quyền Admin.

### 3.2. Yêu cầu & Giới hạn khi vận hành hệ thống mới
Bên cạnh các lợi ích nghiệp vụ, việc sử dụng hệ thống phần mềm chuyên dụng sẽ đi kèm các yêu cầu thay đổi sau:
1.  **Quy trình thao tác người dùng (Giao diện mới):** Nhân sự cần thời gian đào tạo để chuyển từ việc nhập liệu trực tiếp trên bảng tính sang thao tác trên các Form (Biểu mẫu) của ứng dụng Web.
2.  **Định dạng Dữ liệu (Cấu trúc cố định):** Trong Google Sheets, người dùng có thể tùy ý tự thêm cột dữ liệu mới (ví dụ: "Ghi chú nhanh", "Tình trạng riêng") ngay lập tức. Trong Proxy Manager, cấu trúc dữ liệu cơ sở đã được chuẩn hóa. Mọi yêu cầu thêm mới các chỉ mục/cột thông tin đều phải được thông qua lập trình viên để cập nhật trên CSDL và giao diện hệ thống.
3.  **Chi phí hạ tầng và Bảo trì:** Hệ thống Proxy Manager yêu cầu khởi chạy và duy trì trên máy chủ độc lập (VPS/Server) 24/7. Điều này phát sinh chi phí hạ tầng máy chủ định kỳ, cũng như yêu cầu quy trình bảo trì, sao lưu (backup) dữ liệu thường xuyên để tránh sự cố kỹ thuật.

### 4. Kết luận
Triển khai hệ thống Proxy Manager phù hợp với định hướng tự động hóa, quy mô lưu trữ lớn và nhu cầu tích hợp API cho các công cụ nghiệp vụ khác. Quy trình này sẽ thay thế hoàn toàn thao tác thủ công trên Google Sheets, tuy nhiên yêu cầu cam kết về chi phí vận hành máy chủ và thay đổi thói quen nhập liệu của đội ngũ.
