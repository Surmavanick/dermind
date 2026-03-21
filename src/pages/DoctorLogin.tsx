import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const AUTH_KEY = "doctor_auth_session";

const DoctorLogin = () => {
  const navigate = useNavigate();
  const [doctorId, setDoctorId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAuthenticated = useMemo(() => {
    return Boolean(localStorage.getItem(AUTH_KEY));
  }, []);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!doctorId.trim() || !password.trim()) {
      setError("Please fill Doctor ID and password.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({
          doctorId: doctorId.trim(),
          loginAt: new Date().toISOString(),
        })
      );
      navigate("/dashboard");
    }, 700);
  };

  const enterDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md glass-card border border-border rounded-2xl p-7">
        <h1 className="text-2xl font-display font-bold text-foreground">Doctor Login</h1>
        <p className="text-sm text-muted-foreground mt-2 mb-6">
          Simulated authentication for dermatologist access.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-muted-foreground">Doctor ID</label>
            <input
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="e.g. DR-1024"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-muted-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="••••••••"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button
            type="submit"
            className="w-full gradient-clinical text-primary-foreground font-medium"
            disabled={loading}
          >
            {loading ? "Authenticating..." : "Login and Open AI Dashboard"}
          </Button>
        </form>

        {isAuthenticated ? (
          <Button
            variant="outline"
            className="w-full mt-3"
            onClick={enterDashboard}
          >
            Already logged in - Enter Dashboard
          </Button>
        ) : null}

        <Button
          variant="ghost"
          className="w-full mt-2"
          onClick={() => navigate("/")}
        >
          Back to Home
        </Button>
      </div>
    </div>
  );
};

export default DoctorLogin;
