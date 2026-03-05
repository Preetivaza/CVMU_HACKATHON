import { NextResponse } from 'next/server';
import { HTTP_STATUS } from '@/utils/constants';
import { verifyAuth } from '@/lib/auth';
import { getCollection, COLLECTIONS } from '@/lib/db';

/** GET /api/v1/reports/export — export all clusters as CSV */
export async function GET(request) {
    try {
        const { isValid } = await verifyAuth(request);
        if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });

        const col = await getCollection(COLLECTIONS.CLUSTERS);
        const clusters = await col.find({}).sort({ 'properties.final_risk_score': -1 }).toArray();

        const header = 'id,damage_type,risk_level,risk_score,status,repeat_count,lat,lon,first_detected,last_detected\n';
        const rows = clusters.map(c => {
            const p = c.properties || {};
            const [lon, lat] = c.geometry?.coordinates || [0, 0];
            return [
                c._id.toString(),
                p.damage_type || 'unknown',
                p.risk_level || 'Low',
                ((p.final_risk_score || 0) * 100).toFixed(1),
                p.status || 'pending',
                p.repeat_count || 1,
                lat.toFixed(6),
                lon.toFixed(6),
                c.first_detected ? new Date(c.first_detected).toISOString().slice(0, 10) : '',
                c.last_detected ? new Date(c.last_detected).toISOString().slice(0, 10) : '',
            ].join(',');
        }).join('\n');

        const csv = header + rows;
        const date = new Date().toISOString().slice(0, 10);
        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="sadaksurksha_report_${date}.csv"`,
            }
        });
    } catch (e) {
        return NextResponse.json({ error: 'Export failed', details: e.message }, { status: HTTP_STATUS.INTERNAL_ERROR });
    }
}
