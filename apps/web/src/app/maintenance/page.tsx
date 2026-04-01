export default function MaintenancePage() {
    return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                        <path d="M12 9v4"/><path d="M12 17h.01"/>
                    </svg>
                </div>
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight text-white mb-2">
                        Under Maintenance
                    </h1>
                    <p className="text-white/50 font-medium text-sm leading-relaxed">
                        AirTrainr is temporarily offline for scheduled maintenance. We'll be back shortly.
                    </p>
                </div>
                <p className="text-white/30 text-xs font-medium uppercase tracking-widest">
                    AirTrainr Platform
                </p>
            </div>
        </div>
    );
}
