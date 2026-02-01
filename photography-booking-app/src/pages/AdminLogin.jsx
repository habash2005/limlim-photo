// src/pages/AdminLogin.jsx
import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";

function cls(...xs) { return xs.filter(Boolean).join(" "); }

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setVisible(true);
  }, []);

  const login = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/admin");
    } catch (err) {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Admin Login | Lama Wafa Photography</title>
      </Helmet>

      <div className="min-h-screen bg-cream">
        {/* Header */}
        <section className="relative bg-burgundy overflow-hidden -mt-16 md:-mt-20 pt-24 md:pt-32 pb-16 md:pb-20">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/2 w-96 h-96 bg-gold rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div
              className={cls(
                "transition-all duration-700",
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <div className="w-12 h-0.5 bg-gold mx-auto mb-6" />
              <h1 className="font-serif text-3xl md:text-4xl font-light text-white">
                Admin Login
              </h1>
              <p className="mt-4 text-white/70">
                Sign in to access the dashboard
              </p>
            </div>
          </div>
        </section>

        {/* Login Form */}
        <section className="py-12 md:py-16">
          <div className="max-w-md mx-auto px-4">
            <div
              className={cls(
                "transition-all duration-700 delay-200",
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <div className="bg-white border border-burgundy/10 shadow-soft p-8">
                <div className="text-center mb-8">
                  <div className="w-14 h-14 bg-burgundy/10 text-burgundy flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                  </div>
                  <h2 className="font-serif text-xl text-charcoal">
                    Welcome Back
                  </h2>
                  <p className="mt-2 text-sm text-charcoal/60">
                    Enter your credentials to continue
                  </p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-100 text-sm text-red-600 text-center flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    {error}
                  </div>
                )}

                <form onSubmit={login} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                      </svg>
                      <input
                        type="email"
                        className="input pl-10"
                        placeholder="admin@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-charcoal mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                      <input
                        type="password"
                        className="input pl-10"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className={cls(
                      "btn w-full justify-center py-3",
                      loading ? "bg-burgundy/30 text-white/60 cursor-not-allowed" : "btn-primary"
                    )}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
