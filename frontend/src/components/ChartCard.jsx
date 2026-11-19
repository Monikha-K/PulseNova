export default function ChartCard({ title, subtitle, children, action, style }) {
  return (
    <div className="card" style={style}>
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {subtitle && <div className="card-subtitle">{subtitle}</div>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}
