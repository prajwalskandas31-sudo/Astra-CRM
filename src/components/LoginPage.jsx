import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import {
  Ripple,
  TechOrbitDisplay,
  AnimatedForm,
  BoxReveal,
} from './ui/modern-animated-sign-in';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Wifi,
  Database,
  Lock,
  Users,
  LineChart,
  Command,
  Cloud,
  CheckCircle2,
  Server
} from 'lucide-react';

const iconsArray = [
  {
    component: () => (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
        <Shield size={16} />
      </div>
    ),
    className: 'size-[36px] border-none bg-transparent',
    duration: 22,
    delay: 20,
    radius: 95,
    path: true,
    reverse: false,
  },
  {
    component: () => (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
        <Database size={16} />
      </div>
    ),
    className: 'size-[36px] border-none bg-transparent',
    duration: 22,
    delay: 9,
    radius: 95,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400">
        <Users size={18} />
      </div>
    ),
    className: 'size-[44px] border-none bg-transparent',
    radius: 155,
    duration: 26,
    delay: 15,
    path: true,
    reverse: true,
  },
  {
    component: () => (
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
        <LineChart size={18} />
      </div>
    ),
    className: 'size-[44px] border-none bg-transparent',
    radius: 155,
    duration: 26,
    delay: 2,
    path: false,
    reverse: true,
  },
  {
    component: () => (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
        <Command size={20} />
      </div>
    ),
    className: 'size-[50px] border-none bg-transparent',
    radius: 220,
    duration: 32,
    delay: 25,
    path: true,
    reverse: false,
  },
  {
    component: () => (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
        <Server size={20} />
      </div>
    ),
    className: 'size-[50px] border-none bg-transparent',
    radius: 220,
    duration: 32,
    delay: 8,
    path: false,
    reverse: false,
  },
  {
    component: () => (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
        <Lock size={19} />
      </div>
    ),
    className: 'size-[50px] border-none bg-transparent',
    radius: 280,
    duration: 38,
    delay: 18,
    path: true,
    reverse: true,
  },
  {
    component: () => (
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.2)]">
        <Cloud size={19} />
      </div>
    ),
    className: 'size-[50px] border-none bg-transparent',
    radius: 280,
    duration: 38,
    delay: 35,
    path: false,
    reverse: true,
  },
];

export const LoginPage = () => {
  const { loginError, handleLogin, detectedIP, ipDetecting, prefetchIP } = useCRM();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fetch IP as soon as login page mounts
  useEffect(() => {
    prefetchIP();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    await handleLogin(identifier, password);
    setIsSubmitting(false);
  };

  const formFields = [
    {
      label: 'Username / Email / Mobile',
      required: true,
      type: 'text',
      placeholder: 'superadmin@company.com or Srinivas R',
      value: identifier,
      onChange: (e) => setIdentifier(e.target.value),
    },
    {
      label: 'Password',
      required: true,
      type: 'password',
      placeholder: 'Enter your password',
      value: password,
      onChange: (e) => setPassword(e.target.value),
    },
  ];

  return (
    <div className="min-h-screen w-full bg-[#090a0f] text-neutral-100 flex flex-col justify-center items-center relative overflow-hidden select-none px-4 py-8">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center z-10">
        {/* Left Side: Modern Tech Orbit Display with Ripple */}
        <div className="relative flex flex-col items-center justify-center min-h-[460px] lg:min-h-[580px] w-full overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-md">
          <Ripple mainCircleSize={110} mainCircleOpacity={0.18} numCircles={8} />
          <TechOrbitDisplay iconsArray={iconsArray} text="Astra CRM" />

          {/* Bottom Trust Pills */}
          <div className="absolute bottom-6 flex items-center gap-4 text-[11px] text-neutral-400 font-medium z-10">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-400" /> End-to-End Encrypted
            </span>
            <span className="text-neutral-700">•</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-indigo-400" /> RBAC Enforced
            </span>
          </div>
        </div>

        {/* Right Side: Animated Form */}
        <div className="flex flex-col items-center justify-center w-full px-2 sm:px-6">
          <div className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-neutral-900/60 backdrop-blur-xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <AnimatedForm
              header="Welcome back"
              subHeader="Sign in to your Astra CRM workspace"
              fields={formFields}
              submitButton={isSubmitting ? "Authenticating..." : "Sign in"}
              errorField={loginError}
              onSubmit={handleSubmit}
            >
              {/* IP Shield Status Bar */}
              <BoxReveal boxColor="#6e56cf" duration={0.3} width="100%">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-3 border ${
                  detectedIP
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                }`}>
                  {ipDetecting ? (
                    <>
                      <Wifi size={13} className="text-amber-400 animate-pulse flex-shrink-0" />
                      <span>Detecting authorized network IP...</span>
                    </>
                  ) : detectedIP ? (
                    <>
                      <ShieldCheck size={13} className="text-emerald-400 flex-shrink-0" />
                      <span className="text-neutral-300">
                        IP: <code className="text-emerald-400 font-mono font-bold">{detectedIP}</code>
                      </span>
                      <span className="ml-auto text-[10px] text-neutral-400 font-medium flex items-center gap-1">
                        🔒 IP Guard Active
                      </span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert size={13} className="text-amber-400 flex-shrink-0" />
                      <span>IP Detection Offline — Fail-Safe Active</span>
                    </>
                  )}
                </div>
              </BoxReveal>
            </AnimatedForm>
          </div>
        </div>
      </div>
    </div>
  );
};
