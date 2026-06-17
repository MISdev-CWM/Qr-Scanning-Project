import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useNavigate } from 'react-router-dom'

export const LoginForm = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const { login } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!username || !password) {
      showToast('Please fill in all fields', 'warning')
      return
    }

    setIsLoading(true)

    try {
      const response = await login(username, password, rememberMe)
      showToast('Login successful', 'success')
      const role = (response.user?.role || '').toLowerCase()
      
      // Redirect based on user role
      if (role === 'security') return navigate('/security/scan', { replace: true })
      if (role === 'process') return navigate('/process/scan', { replace: true })
      return navigate('/dashboard', { replace: true })
    } catch (error) {
      showToast(
        error?.response?.data?.error || 'Invalid credentials',
        'error'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label="Username"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="user"
        required
      />

      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        required
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <input
            id="remember-me"
            name="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
          />
          <label
            htmlFor="remember-me"
            className="ml-2 block text-sm text-slate-900"
          >
            Remember me
          </label>
        </div>

        {/* <div className="text-sm">
          <a
            href="#"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Forgot password?
          </a>
        </div> */}
      </div>

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Sign in
      </Button>
    </form>
  )
}
