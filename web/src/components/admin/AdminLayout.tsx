import { useState, useEffect } from 'react';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

const AdminLayout = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('admin_token');
        if (token === 'valid') {
            setIsAuthenticated(true);
        }

        // Allow zooming and scrolling in Admin Panel
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
            const originalContent = viewportMeta.getAttribute('content');
            viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');

            return () => {
                if (originalContent) {
                    viewportMeta.setAttribute('content', originalContent);
                }
            };
        }
    }, []);

    const handleLogin = () => {
        localStorage.setItem('admin_token', 'valid');
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        setIsAuthenticated(false);
    };

    if (!isAuthenticated) {
        return <AdminLogin onLogin={handleLogin} />;
    }

    return <AdminDashboard onLogout={handleLogout} />;
};

export default AdminLayout;
