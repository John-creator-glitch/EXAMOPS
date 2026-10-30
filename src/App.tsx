import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/DashboardLayout';
import LoginPage from '@/pages/LoginPage';
import SignUpPage from '@/pages/SignUpPage';
import DashboardOverview from '@/pages/DashboardOverview';
import TenantsPage from '@/pages/TenantsPage';
import UsersPage from '@/pages/UsersPage';
import ProgramsPage from '@/pages/ProgramsPage';
import CoursesPage from '@/pages/CoursesPage';
import RoomsPage from '@/pages/RoomsPage';
import FacultyPage from '@/pages/FacultyPage';
import { Card } from '@/components/ui/Card';
import { Construction } from 'lucide-react';

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">{title}</h1>
      <Card className="p-12 text-center">
        <Construction className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-900">Coming Soon</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          This module is part of the upcoming build phases. Module 1 (Foundation) is complete and ready to use.
        </p>
      </Card>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardOverview />} />
            <Route path="tenants" element={<TenantsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="programs" element={<ProgramsPage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="rooms" element={<RoomsPage />} />
            <Route path="faculty" element={<FacultyPage />} />
            <Route path="cycles" element={<ComingSoon title="Exam Cycles" />} />
            <Route path="datesheet" element={<ComingSoon title="Datesheet" />} />
            <Route path="allocation" element={<ComingSoon title="Room Allocation" />} />
            <Route path="invigilation" element={<ComingSoon title="Invigilation" />} />
            <Route path="envelopes" element={<ComingSoon title="Envelope Tracker" />} />
            <Route path="qr" element={<ComingSoon title="QR Publisher" />} />
            <Route path="analytics" element={<ComingSoon title="Analytics" />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
