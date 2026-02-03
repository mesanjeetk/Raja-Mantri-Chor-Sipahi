import { type ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
}

export const Card = ({ children, className = '', onClick }: CardProps) => {
    return (
        <div
            className={`
                bg-white/5 backdrop-blur-sm
                border border-white/10
                rounded-xl p-6
                transition-all duration-200
                ${onClick ? 'cursor-pointer hover:bg-white/10 hover:border-white/20' : ''}
                ${className}
            `}
            onClick={onClick}
        >
            {children}
        </div>
    );
};
