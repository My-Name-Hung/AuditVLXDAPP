import "./Distributors.css";

const sampleDistributors = [
  {
    name: "Công ty TNHH VLXD Miền Nam",
    region: "TP. Hồ Chí Minh",
    manager: "Trần Văn Dũng",
    phone: "0903 123 456",
    stores: 24,
  },
  {
    name: "Nhà phân phối An Phát",
    region: "Đà Nẵng",
    manager: "Nguyễn Thị Thu",
    phone: "0905 888 999",
    stores: 12,
  },
  {
    name: "Công ty CP Xây dựng Bắc Trung Bộ",
    region: "Hà Nội",
    manager: "Phạm Văn Hùng",
    phone: "0902 456 789",
    stores: 30,
  },
];

export default function Distributors() {
  return (
    <div className="page distributors-page">
      <div className="page-header">
        <div>
          <p className="page-kicker">Người dùng & NPP</p>
          <h2>Danh sách nhà phân phối</h2>
          <p className="page-subtitle">
            Quản lý các đối tác phân phối vật liệu xây dựng trên toàn quốc.
          </p>
        </div>
        <div className="action-buttons">
          <button className="btn-secondary">Xuất danh sách</button>
          <button className="btn-primary">Thêm nhà phân phối</button>
        </div>
      </div>

      <div className="distributors-grid">
        {sampleDistributors.map((distributor) => (
          <div className="distributor-card" key={distributor.name}>
            <div className="distributor-card__header">
              <div>
                <p className="card-kicker">{distributor.region}</p>
                <h3>{distributor.name}</h3>
              </div>
              <span className="badge">{distributor.stores} cửa hàng</span>
            </div>
            <div className="distributor-card__content">
              <p>
                <strong>Quản lý:</strong> {distributor.manager}
              </p>
              <p>
                <strong>Liên hệ:</strong> {distributor.phone}
              </p>
            </div>
            <div className="distributor-card__actions">
              <button className="btn-secondary">Chi tiết</button>
              <button className="btn-primary">Gửi báo cáo</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

