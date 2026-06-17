import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Users,
  QrCode,
  Clock,
  Coffee,
  BarChart3,
  LogOut,
  Cpu,
  UserCog,
  Scan,
  ClockFading
} from 'lucide-react'
import { IoTimerOutline } from "react-icons/io5";
import { useAuth } from '../../hooks/useAuth'

export const Sidebar = () => {
  const { logout, user } = useAuth()

  // Admin navigation items
  const adminNavItems = [
    {
      to: '/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
    },
    {
      to: '/companies',
      icon: Building2,
      label: 'Companies',
    },
    {
      to: '/employees',
      icon: Users,
      label: 'Employees',
    },
    {
      to: '/users',
      icon: UserCog,
      label: 'Users & Roles',
    },
    {
      to: '/processes',
      icon: Cpu,
      label: 'Processes',
    },
    {
      to: '/attendance',
      icon: QrCode,
      label: 'Attendance',
    },
    {
      to: '/work-sessions',
      icon: Clock,
      label: 'Work Sessions',
    },
    {
      to: '/ot-hours',
      icon: IoTimerOutline,
      label: 'OT Hours',
    },
    {
      to: '/breaks',
      icon: Coffee,
      label: 'Breaks',
    },
    {
      to: '/changeovers',
      icon: ClockFading,
      label: 'Temporary Changeovers',
    },
    {
      to: '/analytics',
      icon: BarChart3,
      label: 'Analytics',
    },
  ]

  // Process navigation items
  const processNavItems = [
    {
      to: '/process/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
    },
    {
      to: '/process/scan',
      icon: Scan,
      label: 'Scanner',
    },
  ]

  // Security navigation items
  const securityNavItems = [
    {
      to: '/security/scan',
      icon: Scan,
      label: 'Attendance Scanner',
    },
  ]

  // Select navigation items based on user role
  let navItems = adminNavItems
  if (user?.role === 'process') {
    navItems = processNavItems
  } else if (user?.role === 'security') {
    navItems = securityNavItems
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-wider text-center">
          EMPLOYEE EFFICIENCY <span className="text-blue-600 ">SYSTEM</span>
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `
              flex items-center px-4 py-3 rounded-md transition-colors
              ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }
            `
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={logout}
          className="flex items-center w-full px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-md transition-colors"
        >
          <LogOut className="w-5 h-5 mr-3" />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
