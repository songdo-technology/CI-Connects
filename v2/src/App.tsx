import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider } from './lib/auth';
import { MotionRoot, Grain } from './lib/motion';
import { Intro } from './components/Intro';
import { PublicLayout, AppShell, RequireAuth, RequireStaff, RequireAdmin } from './components/layouts';
import { Landing, EventsIndex, EventPublic, SignIn } from './pages/public';
import { Dashboard, ProfilePage, NotFound } from './pages/app';
import { EventLayout, SchedulePage, MySchedulePage, SpeakersPage, VenuePage, BadgePage, SponsorsPage } from './pages/event';
import { DoorQr, HerePage } from './pages/checkin';
import { AdminLayout, AdminHome, AdminEvents, AdminEventEdit, AdminPeople, AdminAnnouncements, AdminSettings } from './pages/admin';
import { AdminSchedule, AdminAccess, AdminCheckIn, AdminSponsors } from './pages/admin-event';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MotionRoot />
        <Grain />
        <Intro />
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Landing />} />
            <Route path="events" element={<EventsIndex />} />
            <Route path="events/:slug" element={<EventPublic />} />
            <Route path="signin" element={<SignIn />} />
          </Route>

          <Route element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="me" element={<ProfilePage />} />
            <Route path="e/:slug" element={<EventLayout />}>
              <Route index element={<Navigate to="schedule" replace />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="schedule/:sessionId" element={<SchedulePage />} />
              <Route path="mine" element={<MySchedulePage />} />
              <Route path="speakers" element={<SpeakersPage />} />
              <Route path="venue" element={<VenuePage />} />
              <Route path="badge" element={<BadgePage />} />
              <Route path="sponsors" element={<SponsorsPage />} />
              <Route path="here" element={<HerePage />} />
            </Route>
            <Route path="admin" element={<RequireStaff />}>
              <Route element={<AdminLayout />}>
                <Route index element={<AdminHome />} />
                <Route path="events" element={<AdminEvents />} />
                <Route path="events/:id/schedule" element={<AdminSchedule />} />
                <Route path="events/:id/checkin" element={<AdminCheckIn />} />
                <Route path="events/:id/sponsors" element={<AdminSponsors />} />
                <Route element={<RequireAdmin />}>
                  <Route path="events/new" element={<AdminEventEdit />} />
                  <Route path="events/:id" element={<AdminEventEdit />} />
                  <Route path="events/:id/access" element={<AdminAccess />} />
                  <Route path="people" element={<AdminPeople />} />
                  <Route path="announcements" element={<AdminAnnouncements />} />
                  <Route path="settings" element={<AdminSettings />} />
                </Route>
              </Route>
            </Route>
          </Route>

          <Route element={<RequireAuth />}>
            <Route path="door/:eventId/:sessionId" element={<DoorQr />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
