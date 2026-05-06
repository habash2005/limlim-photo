// src/main.jsx
import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";

import App from "./App";
import Home from "./pages/Home";

// Lazy-loaded routes — keeps the public homepage chunk small.
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Booking = lazy(() => import("./pages/Booking"));
const FAQ = lazy(() => import("./pages/FAQ"));
const ClientGallery = lazy(() => import("./pages/ClientGallery"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminBookings = lazy(() => import("./pages/AdminBookings"));
const AdminAlbumEditor = lazy(() => import("./pages/AdminAlbumEditor"));

import ProtectedRoute from "./components/ProtectedRoute";

function PageFallback() {
  return (
    <div className="w-full min-h-[40vh] grid place-items-center text-charcoal/60 font-serif italic">
      Loading…
    </div>
  );
}

function withSuspense(node) {
  return <Suspense fallback={<PageFallback />}>{node}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      // Public
      { index: true, element: <Home /> },
      { path: "portfolio", element: withSuspense(<Portfolio />) },
      { path: "booking", element: withSuspense(<Booking />) },
      { path: "faq", element: withSuspense(<FAQ />) },

      // Clients
      { path: "portal", element: withSuspense(<ClientPortal />) },
      { path: "client", element: withSuspense(<ClientGallery />) },

      // Auth
      { path: "admin-login", element: withSuspense(<AdminLogin />) },

      // Admin
      {
        path: "admin",
        element: (
          <ProtectedRoute>
            {withSuspense(<AdminDashboard />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/bookings",
        element: (
          <ProtectedRoute>
            {withSuspense(<AdminBookings />)}
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/album/:bookingId",
        element: (
          <ProtectedRoute>
            {withSuspense(<AdminAlbumEditor />)}
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <RouterProvider router={router} />
    </HelmetProvider>
  </React.StrictMode>
);
