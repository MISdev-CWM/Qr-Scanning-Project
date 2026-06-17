import React from 'react'

export const AuthLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          EMPLOYEE EFFICIENCY <span className="text-blue-600">SYSTEM</span>
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Sign in to access the management portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border border-slate-200">
          {children}
        </div>
      </div>
    </div>
  )
}
