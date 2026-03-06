'use client';

import { usePathname } from 'next/navigation';
import AppShell from './AppShell';

// Pages that should NOT use the AppShell (no sidebar/header)
const PUBLIC_PATHS = ['/login', '/landing', '/public-report'];

export default function ConditionalShell({ children }) {
    const pathname = usePathname();
    const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));

    if (isPublic) {
        return <>{children}</>;
    }

    return <AppShell>{children}</AppShell>;
}
