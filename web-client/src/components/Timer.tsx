interface TimerProps {
    timeRemaining: number;
    totalTime: number;
    type: 'gameStart' | 'round' | 'nextRound';
}

export const Timer = ({ timeRemaining, totalTime, type }: TimerProps) => {
    const percentage = (timeRemaining / totalTime) * 100;

    // Color based on time remaining
    const getColor = () => {
        if (percentage > 50) return 'from-green-500 to-emerald-500';
        if (percentage > 25) return 'from-yellow-500 to-orange-500';
        return 'from-red-500 to-pink-500';
    };

    const getLabel = () => {
        switch (type) {
            case 'gameStart':
                return 'Game Starting in';
            case 'round':
                return 'Time Remaining';
            case 'nextRound':
                return 'Next Round in';
        }
    };

    const getSize = () => {
        return type === 'gameStart' || type === 'nextRound' ? 'large' : 'small';
    };

    const size = getSize();

    if (size === 'large') {
        // Full-screen countdown overlay
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
                <div className="text-center space-y-8 animate-pulse">
                    <div className={`text-9xl font-bold bg-gradient-to-r ${getColor()} bg-clip-text text-transparent transition-all duration-300 scale-110 hover:scale-125`}>
                        {timeRemaining}
                    </div>
                    <div className="text-3xl text-white font-semibold">
                        {getLabel()}
                    </div>
                    {type === 'gameStart' && (
                        <div className="text-xl text-gray-400">
                            Get ready to play!
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Compact timer for round
    return (
        <div className="flex items-center gap-3 px-4 py-2 bg-white/10 rounded-lg border border-white/20 backdrop-blur-sm">
            <div className="relative w-12 h-12">
                {/* Circular progress */}
                <svg className="transform -rotate-90 w-12 h-12">
                    <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="transparent"
                        className="text-white/20"
                    />
                    <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={`${2 * Math.PI * 20}`}
                        strokeDashoffset={`${2 * Math.PI * 20 * (1 - percentage / 100)}`}
                        className={`bg-gradient-to-r ${getColor()} transition-all duration-1000`}
                        style={{
                            stroke: percentage > 50 ? '#10b981' : percentage > 25 ? '#f59e0b' : '#ef4444'
                        }}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-white font-bold">
                    {timeRemaining}
                </div>
            </div>
            <div className="flex flex-col">
                <span className="text-sm text-gray-400">{getLabel()}</span>
                <span className="text-xs text-gray-500">Make your guess!</span>
            </div>
        </div>
    );
};

export default Timer;
