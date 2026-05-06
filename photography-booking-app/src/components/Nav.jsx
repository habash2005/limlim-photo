// src/components/Nav.jsx
import React, { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

function cls(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const menuId = "mobile-nav-menu";

  // Check if we're on the home page (for transparent nav)
  const isHomePage = location.pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial state
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { to: "/portfolio", label: "Portfolio" },
    { to: "/booking", label: "Book" },
    { to: "/portal", label: "Client Portal" },
    { to: "/faq", label: "FAQ" },
  ];

  // Determine nav style based on scroll and page
  const isTransparent = isHomePage && !scrolled && !open;

  return (
    <>
      <header
        className={cls(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          isTransparent
            ? "bg-transparent"
            : "bg-white/95 backdrop-blur-lg shadow-soft border-b border-burgundy/10"
        )}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link
              to="/"
              className="group flex items-center gap-2.5"
              aria-label="Go to home"
            >
              <img
                src="/lama-logo.png"
                alt="Lama Wafa"
                className={cls(
                  "h-9 w-9 md:h-10 md:w-10 object-contain transition-all",
                  isTransparent ? "drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]" : ""
                )}
                draggable="false"
              />
              <span className={cls(
                "font-serif text-lg md:text-xl font-semibold tracking-tight transition-colors",
                isTransparent ? "text-white" : "text-charcoal"
              )}>
                Lama Wafa
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cls(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                      isActive
                        ? isTransparent
                          ? "text-gold bg-white/10"
                          : "text-burgundy bg-burgundy/5"
                        : isTransparent
                        ? "text-white/80 hover:text-white hover:bg-white/10"
                        : "text-charcoal/70 hover:text-burgundy hover:bg-burgundy/5"
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <div className={cls(
                "w-px h-6 mx-2",
                isTransparent ? "bg-white/20" : "bg-burgundy/20"
              )} />
              <Link to="/booking">
                <button className="btn btn-gold text-sm px-5 py-2.5">
                  Book Now
                </button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              aria-label="Toggle menu"
              aria-controls={menuId}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={cls(
                "md:hidden relative w-10 h-10 flex items-center justify-center rounded-full transition-colors",
                open
                  ? "bg-burgundy/10"
                  : isTransparent
                  ? "hover:bg-white/10"
                  : "hover:bg-burgundy/5"
              )}
            >
              <div className="relative w-5 h-4 flex flex-col justify-between">
                <span
                  className={cls(
                    "absolute h-0.5 w-5 rounded-full transition-all duration-300 origin-center",
                    isTransparent && !open ? "bg-white" : "bg-charcoal",
                    open ? "rotate-45 top-1.5" : "top-0"
                  )}
                />
                <span
                  className={cls(
                    "absolute h-0.5 w-5 rounded-full transition-all duration-200 top-1.5",
                    isTransparent && !open ? "bg-white" : "bg-charcoal",
                    open ? "opacity-0 scale-x-0" : "opacity-100"
                  )}
                />
                <span
                  className={cls(
                    "absolute h-0.5 w-5 rounded-full transition-all duration-300 origin-center",
                    isTransparent && !open ? "bg-white" : "bg-charcoal",
                    open ? "-rotate-45 top-1.5" : "top-3"
                  )}
                />
              </div>
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        <div
          id={menuId}
          className={cls(
            "md:hidden absolute top-full left-0 right-0 bg-white border-t border-burgundy/10 shadow-lg",
            "transition-all duration-300 ease-out overflow-hidden",
            open ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cls(
                    "block px-4 py-3 rounded-xl text-base font-medium transition-all duration-200",
                    isActive
                      ? "text-burgundy bg-burgundy/10"
                      : "text-charcoal/80 hover:text-burgundy hover:bg-burgundy/5"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="pt-3">
              <Link to="/booking" className="block">
                <button className="btn btn-gold w-full justify-center">
                  Book Now
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Backdrop overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Spacer for fixed header - only show on non-home pages */}
      {!isHomePage && <div className="h-16 md:h-20" />}
    </>
  );
}
