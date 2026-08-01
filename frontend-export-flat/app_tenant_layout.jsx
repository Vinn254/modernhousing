'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
export default function TenantLayout({ children, }) {
    const router = useRouter();
    const pathname = usePathname();
    useEffect(() => {
        if (pathname === '/tenant/register')
            return;
        const checkTenant = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            const userRole = user.user_metadata?.role;
            if (userRole !== 'tenant') {
                router.push('/');
                return;
            }
        };
        checkTenant();
    }, [router, pathname]);
    return <>{children}</>;
}
