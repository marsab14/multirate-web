import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";
import Login from "./routes/Login";
import Signup from "./routes/Signup";
import DocumentsList from "./routes/DocumentsList";
import DocumentEditor from "./routes/DocumentEditor";
import Reports from "./routes/Reports";
import NotFound from "./routes/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/documents" replace />} />
        <Route path="/documents" element={<DocumentsList />} />
        <Route path="/documents/new" element={<DocumentEditor />} />
        <Route path="/documents/:id" element={<DocumentEditor />} />
        <Route path="/reports" element={<Reports />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
