import "./ImportExport.css";

export default function ImportExport() {
  return (
    <div className="page import-export-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Dữ liệu</p>
          <h2>Upload / Download</h2>
          <p className="page-subtitle">
            Đồng bộ dữ liệu chương trình, cửa hàng và nhà phân phối theo chuẩn
            Excel.
          </p>
        </div>
        <div className="action-buttons">
          <button className="btn-secondary">Tải template Excel</button>
          <button className="btn-primary">Xuất toàn bộ dữ liệu</button>
        </div>
      </div>

      <div className="import-export-grid">
        <section className="import-card">
          <div>
            <h3>Tải dữ liệu lên</h3>
            <p>
              Hỗ trợ định dạng <strong>.xlsx</strong> và{" "}
              <strong>.csv UTF-8</strong>. Vui lòng sử dụng template mới nhất để
              tránh sai cột.
            </p>
          </div>
          <div className="upload-area">
            <input type="file" id="fileUpload" accept=".xlsx,.csv" hidden />
            <label htmlFor="fileUpload" className="upload-box">
              <span className="upload-icon">⬆️</span>
              <div>
                <strong>Chọn tệp dữ liệu</strong>
                <p>Kích thước tối đa 10MB</p>
              </div>
            </label>
            <button className="btn-primary">Bắt đầu xử lý</button>
          </div>
        </section>

        <section className="history-card">
          <h3>Lịch sử import gần đây</h3>
          <ul>
            <li>
              <div>
                <strong>Danh sách cửa hàng</strong>
                <p>09:15 - 12/01/2025 - 1.254 bản ghi</p>
              </div>
              <span className="status success">Thành công</span>
            </li>
            <li>
              <div>
                <strong>Chương trình khuyến mãi Q1</strong>
                <p>15:42 - 08/01/2025 - 64 bản ghi</p>
              </div>
              <span className="status warning">Thiếu dữ liệu</span>
            </li>
            <li>
              <div>
                <strong>Nhà phân phối miền Bắc</strong>
                <p>08:10 - 05/01/2025 - 18 bản ghi</p>
              </div>
              <span className="status success">Thành công</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

