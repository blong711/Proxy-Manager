"use client";
import { BookOpen, Globe, Users, Building2, Zap, ShieldCheck } from "lucide-react";

export default function GuidePage() {
    return (
        <div className="space-y-8 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center">
                    <BookOpen className="w-6 h-6 mr-3 text-violet-400" />
                    Hướng dẫn sử dụng (Quy trình)
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                    Quy trình chuẩn để quản lý Proxy & Tài khoản một cách hiệu quả và an toàn.
                </p>
            </div>

            <div className="space-y-6">
                {/* Step 1 */}
                <div className="bg-[#0d1426] border border-white/5 rounded-xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <Building2 className="w-32 h-32" />
                    </div>
                    <h2 className="text-lg font-semibold text-white flex items-center mb-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 text-xs mr-3">1</span>
                        Thiết lập Nhà cung cấp (Providers)
                    </h2>
                    <div className="text-slate-300 text-sm space-y-2 relative z-10 w-3/4">
                        <p>Đây là bước đầu tiên để hệ thống biết bạn đang mua proxy từ nguồn nào.</p>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-slate-400">
                            <li>Vào menu <strong className="text-slate-200">Providers</strong></li>
                            <li>Bấm <strong>Add Provider</strong>.</li>
                            <li>Điền tên nhà cung cấp (Ví dụ: <em>Tinsoft, TMProxy, Vultr</em>).</li>
                            <li><em>(Tùy chọn)</em> Điền API URL và API Key nếu bạn định dùng tính năng Mua/Gia hạn tự động sau này.</li>
                        </ul>
                    </div>
                </div>

                {/* Step 2 */}
                <div className="bg-[#0d1426] border border-white/5 rounded-xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <Globe className="w-32 h-32" />
                    </div>
                    <h2 className="text-lg font-semibold text-white flex items-center mb-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs mr-3">2</span>
                        Thêm mạng Proxy (Proxies)
                    </h2>
                    <div className="text-slate-300 text-sm space-y-2 relative z-10 w-3/4">
                        <p>Thêm các Proxy mà bạn đã mua/được cấp vào hệ thống để quản lý tập trung.</p>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-slate-400">
                            <li>Vào menu <strong className="text-slate-200">Proxies</strong></li>
                            <li>Bạn có thể thêm lẻ từng cái qua nút <strong>Add Proxy</strong> hoặc dùng nút <strong>Import</strong> để dán nhanh một danh sách dài (<code className="bg-white/10 px-1 rounded">ip:port:user:pass</code>).</li>
                            <li>Gán proxy đó cho Provider ở Bước 1 để tính toán chi phí và theo dõi ngày hết hạn.</li>
                            <li>Sử dụng chức năng <strong>Check All</strong> (Biểu tượng tia sét <Zap className="w-3 h-3 inline text-amber-400" />) để hệ thống tự động PING kiểm tra xem Proxy nào còn sống (Live), Proxy nào đã chết (Die).</li>
                        </ul>
                    </div>
                </div>

                {/* Step 3 */}
                <div className="bg-[#0d1426] border border-white/5 rounded-xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <Users className="w-32 h-32" />
                    </div>
                    <h2 className="text-lg font-semibold text-white flex items-center mb-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs mr-3">3</span>
                        Quản lý Tài khoản (Accounts) & Gán Proxy
                    </h2>
                    <div className="text-slate-300 text-sm space-y-2 relative z-10 w-3/4">
                        <p>Bước cốt lõi nhất: Bảo vệ tài khoản hiển thị địa chỉ IP riêng biệt, chống chết chùm.</p>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-slate-400">
                            <li>Vào menu <strong className="text-slate-200">Accounts</strong></li>
                            <li>Bấm <strong>Add Account</strong>. Kho Lưu trữ thông tin tài khoản (TikTok, Amazon, eBay...).</li>
                            <li>Tại dòng <strong>Proxy Binding</strong>, hãy sổ xuống và chọn một Proxy <em>Live (màu xanh)</em> đã tạo ở Bước 2.</li>
                            <li>Hệ thống lưu trữ ID tương ứng. Khi bạn hoặc hệ thống làm việc với tài khoản đó, lưu lượng mạng sẽ định tuyến chính xác qua Proxy này.</li>
                        </ul>
                    </div>
                </div>

                {/* Step 4 */}
                <div className="bg-[#0d1426] border border-white/5 rounded-xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <ShieldCheck className="w-32 h-32" />
                    </div>
                    <h2 className="text-lg font-semibold text-amber-400 flex items-center mb-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs mr-3">4</span>
                        Lịch trình Giám sát (Hằng ngày)
                    </h2>
                    <div className="text-slate-300 text-sm space-y-2 relative z-10 w-3/4">
                        <p>Để đảm bảo chi phí và sự an toàn của toàn bộ dàn tài khoản:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-slate-400">
                            <li>Mở trang <strong>Dashboard</strong>: Xem tổng chi phí hàng tháng, nhận thông báo các Proxy <em>sắp hết hạn</em>.</li>
                            <li>Mở trang <strong>Proxies</strong>: Chạy Check mạng thường xuyên để vứt bỏ các Proxy Die, thay Proxy mới (tránh việc mất kết nối lúc thao tác tài khoản).</li>
                            <li>Khi Proxy cũ đến hạn hoặc bị Die, tiến hành đổi <em>Proxy Binding</em> cho các tài khoản đang dùng nó sang một Proxy Live khác.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
