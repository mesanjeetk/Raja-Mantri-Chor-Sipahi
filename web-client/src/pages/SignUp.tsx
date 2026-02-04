import { Link, useNavigate } from "react-router-dom"
import { useState } from "react"
import { useAuth } from "../context/AuthContext"
import { Button } from "../components/Button"
import { Input } from "../components/Input"

const SignUp = () => {
    const navigate = useNavigate();
    const { signUp } = useAuth();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        bio: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
        // Clear error for this field
        if (errors[e.target.name]) {
            setErrors(prev => ({ ...prev, [e.target.name]: '' }));
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.username.trim()) {
            newErrors.username = 'Username is required';
        } else if (formData.username.length < 3) {
            newErrors.username = 'Username must be at least 3 characters';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email is invalid';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setIsLoading(true);
        try {
            await signUp(formData.username, formData.email, formData.password, formData.bio);
            navigate('/');
        } catch (error: any) {
            setErrors({ general: error.message || 'Failed to sign up' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#141b3d] to-[#0a0e27] flex justify-center items-center p-4">
            <div className="w-full max-w-md">
                {/* Decorative gradient orbs */}
                <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600/30 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-600/30 rounded-full blur-3xl" />

                <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            Join the Game
                        </h1>
                        <p className="text-gray-400">Create your account to start playing</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {errors.general && (
                            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                                {errors.general}
                            </div>
                        )}

                        <Input
                            type="text"
                            name="username"
                            placeholder="Choose a username"
                            label="Username"
                            value={formData.username}
                            onChange={handleChange}
                            error={errors.username}
                        />

                        <Input
                            type="email"
                            name="email"
                            placeholder="your@email.com"
                            label="Email"
                            value={formData.email}
                            onChange={handleChange}
                            error={errors.email}
                        />

                        <Input
                            type="password"
                            name="password"
                            placeholder="Create a strong password"
                            label="Password"
                            value={formData.password}
                            onChange={handleChange}
                            error={errors.password}
                        />

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Bio (Optional)
                            </label>
                            <textarea
                                name="bio"
                                placeholder="Tell us about yourself..."
                                value={formData.bio}
                                onChange={handleChange}
                                rows={3}
                                className="w-full px-4 py-3 rounded-lg bg-white/5 backdrop-blur-sm border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 resize-none"
                            />
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="w-full"
                            isLoading={isLoading}
                        >
                            Create Account
                        </Button>
                    </form>

                    {/* Sign in link */}
                    <p className="text-center text-gray-400 mt-6">
                        Already have an account?{' '}
                        <Link to="/sign-in" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default SignUp