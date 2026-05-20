export default function AuthLoading() {
    return (
        <main className="min-h-screen w-full flex items-center justify-center bg-white">
            <div
                style={{
                    background: "radial-gradient(100% 100% at 50% 40%, rgba(186, 221, 241, 0.5) 0%, rgba(255, 255, 255, 1) 70%)",
                    backgroundColor: "#FFFFFF",
                    width: "440px",
                    maxWidth: "calc(100% - 32px)",
                    paddingTop: "42px",
                    paddingBottom: "32px",
                    paddingLeft: "32px",
                    paddingRight: "32px",
                    borderRadius: "24px",
                    boxShadow: "0 20px 40px -12px rgba(0,0,0,0.06), 0 0 2px rgba(0,0,0,0.04)",
                    border: "1px solid rgba(255,255,255,0.8)",
                }}
            >
                <div className="flex flex-col gap-6 animate-pulse">
                    <div className="flex flex-col gap-2">
                        <div className="h-7 w-40 bg-slate-100 rounded-lg" />
                        <div className="h-5 w-56 bg-slate-100 rounded-lg" />
                    </div>
                    <div className="h-11 w-full bg-slate-100 rounded-xl" />
                    <div className="h-11 w-full bg-slate-100 rounded-xl" />
                </div>
            </div>
        </main>
    );
}
