import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, className = '', ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={`
                        w-full px-4 py-3 rounded-lg
                        bg-white/5 backdrop-blur-sm
                        border ${error ? 'border-red-500' : 'border-white/20'}
                        text-white placeholder-gray-500
                        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                        transition-all duration-200
                        ${className}
                    `}
                    {...props}
                />
                {error && (
                    <p className="mt-1 text-sm text-red-400">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
