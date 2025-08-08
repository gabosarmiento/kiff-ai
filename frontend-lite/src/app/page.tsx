import { Navbar } from "../components/layout/Navbar";
import { Sidebar } from "../components/layout/Sidebar";

export default function DashboardPage() {
  return (
    <div className="app-shell">
      <Navbar />
      <div className="dashboard-grid">
        <aside className="sidebar pane">
          <Sidebar />
        </aside>
        <main className="pane" style={{ padding: 16 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Dashboard</h1>
          <p className="label" style={{ marginTop: 8 }}>Blank starting point. Use the sidebar to navigate.</p>
        </main>
      </div>
    </div>
  );
}
