'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { Visit } from '@/types/models';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
    LineChart,
    Line
} from 'recharts';
import {
    Users,
    DollarSign,
    Activity,
    Calendar,
    Stethoscope,
    TrendingUp,
    CreditCard
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function DashboardPage() {
    const { appUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const [visits, setVisits] = useState<Visit[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

    // Metrics
    const [totalVisits, setTotalVisits] = useState(0);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [avgDailyVisits, setAvgDailyVisits] = useState(0);

    // Chart Data
    const [visitsByDate, setVisitsByDate] = useState<any[]>([]);
    const [visitsByType, setVisitsByType] = useState<any[]>([]);
    const [revenueByDate, setRevenueByDate] = useState<any[]>([]);
    const [topDoctors, setTopDoctors] = useState<any[]>([]);

    useEffect(() => {
        if (!authLoading && !appUser) {
            router.push('/login');
        }
    }, [appUser, authLoading, router]);

    useEffect(() => {
        const fetchData = async () => {
            if (!appUser) return;

            try {
                setLoading(true);
                // Fetch visits
                // Ideally we would filter by date range here, but for now we fetch all (or limit)
                // Optimization: Use a compound query for date range
                const visitsRef = collection(db, 'visits');
                const q = query(visitsRef, orderBy('createdAt', 'desc'));
                const querySnapshot = await getDocs(q);

                const visitsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Visit));

                setVisits(visitsData);
                processMetrics(visitsData);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [appUser]);

    const processMetrics = (data: Visit[]) => {
        // Basic Metrics
        setTotalVisits(data.length);
        const revenue = data.reduce((acc, curr) => acc + (curr.totalBiaya || 0), 0);
        setTotalRevenue(revenue);

        // Dimension: Time (Date)
        // Group by Date for Trend
        const visitsByDateMap = new Map<string, number>();
        const revenueByDateMap = new Map<string, number>();

        // Dimension: Type (Rawat Jalan, IGD, etc)
        const typeMap = new Map<string, number>();

        // Dimension: Doctor
        const doctorMap = new Map<string, number>();

        data.forEach(visit => {
            // Date handling
            const dateObj = new Date(visit.tanggalKunjungan);
            // Format date as YYYY-MM-DD for sorting/grouping
            const dateKey = dateObj.toISOString().split('T')[0];

            visitsByDateMap.set(dateKey, (visitsByDateMap.get(dateKey) || 0) + 1);
            revenueByDateMap.set(dateKey, (revenueByDateMap.get(dateKey) || 0) + (visit.totalBiaya || 0));

            // Type
            const type = visit.jenis || 'Unknown';
            typeMap.set(type, (typeMap.get(type) || 0) + 1);

            // Doctor
            const doctor = visit.dokter || 'Unassigned';
            doctorMap.set(doctor, (doctorMap.get(doctor) || 0) + 1);
        });

        // Transform maps to arrays for Recharts
        const sortedDates = Array.from(visitsByDateMap.keys()).sort();

        // Filter dates based on current timeRange (simple implementation)
        // For now showing all sorted dates from last 30 entries to avoid overcrowding
        const recentDates = sortedDates.slice(-30);

        const visitsByDateArray = recentDates.map(date => ({
            date: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
            visits: visitsByDateMap.get(date)
        }));

        const revenueByDateArray = recentDates.map(date => ({
            date: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
            revenue: revenueByDateMap.get(date)
        }));

        const visitsByTypeArray = Array.from(typeMap.entries()).map(([name, value]) => ({
            name,
            value
        }));

        const doctorArray = Array.from(doctorMap.entries())
            .map(([name, visits]) => ({ name, visits }))
            .sort((a, b) => b.visits - a.visits)
            .slice(0, 5); // Top 5

        setVisitsByDate(visitsByDateArray);
        setRevenueByDate(revenueByDateArray);
        setVisitsByType(visitsByTypeArray);
        setTopDoctors(doctorArray);

        if (sortedDates.length > 0) {
            setAvgDailyVisits(Math.round(data.length / sortedDates.length));
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard Kunjungan Pasien</h1>
                        <p className="text-gray-500 mt-1">Analitik & Statistik Layanan Kesehatan (Star Schema View)</p>
                    </div>
                    <div className="mt-4 md:mt-0 bg-white shadow rounded-lg p-1.5 flex gap-1">
                        {['week', 'month', 'year'].map((r) => (
                            <button
                                key={r}
                                onClick={() => setTimeRange(r as any)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${timeRange === r
                                        ? 'bg-primary-600 text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {r.charAt(0).toUpperCase() + r.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <MetricCard
                        title="Total Kunjungan"
                        value={totalVisits.toString()}
                        icon={<Users className="h-6 w-6 text-blue-600" />}
                        trend="+12%"
                        trendUp={true}
                        color="bg-blue-50"
                    />
                    <MetricCard
                        title="Total Pendapatan"
                        value={formatCurrency(totalRevenue)}
                        icon={<DollarSign className="h-6 w-6 text-green-600" />}
                        trend="+8%"
                        trendUp={true}
                        color="bg-green-50"
                    />
                    <MetricCard
                        title="Rata-rata Harian"
                        value={avgDailyVisits.toString()}
                        icon={<Activity className="h-6 w-6 text-purple-600" />}
                        trend="-2%"
                        trendUp={false}
                        color="bg-purple-50"
                    />
                    <MetricCard
                        title="Unit Layanan Aktif"
                        value={visitsByType.length.toString()}
                        icon={<Stethoscope className="h-6 w-6 text-orange-600" />}
                        subtext="IGD, Rawat Jalan, dll"
                        color="bg-orange-50"
                    />
                </div>

                {/* Charts Section 1: Timeline & Revenue */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Visits Trend */}
                    <Card title="Tren Kunjungan Pasien" icon={<TrendingUp size={20} />}>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={visitsByDate}>
                                    <defs>
                                        <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} tickMargin={10} />
                                    <YAxis axisLine={false} tickLine={false} fontSize={12} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Area type="monotone" dataKey="visits" stroke="#3b82f6" fillOpacity={1} fill="url(#colorVisits)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* Revenue Trend */}
                    <Card title="Tren Pendapatan" icon={<CreditCard size={20} />}>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueByDate}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={12} tickMargin={10} />
                                    <YAxis axisLine={false} tickLine={false} fontSize={12} tickFormatter={(value) => `Rp ${value / 1000}k`} />
                                    <Tooltip
                                        formatter={(value: any) => formatCurrency(value)}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                {/* Charts Section 2: Distribution & Top Doctors */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Visit Type Distribution */}
                    <Card title="Sebaran Unit Layanan" className="lg:col-span-1" icon={<Calendar size={20} />}>
                        <div className="h-64 w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={visitsByType}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {visitsByType.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Center Text */}
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                                <p className="text-2xl font-bold text-gray-900">{totalVisits}</p>
                                <p className="text-xs text-gray-500">Total</p>
                            </div>
                        </div>
                    </Card>

                    {/* Top Doctors */}
                    <Card title="Top 5 Dokter Teramai" className="lg:col-span-2" icon={<Users size={20} />}>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart layout="vertical" data={topDoctors} margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Bar dataKey="visits" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20}>
                                        {/* Label inside bar or right ? */}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// Sub-components for cleaner code
function MetricCard({ title, value, icon, trend, trendUp, subtext, color }: any) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-2">{value}</h3>
                    {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
                </div>
                <div className={`p-3 rounded-lg ${color}`}>
                    {icon}
                </div>
            </div>
            {trend && (
                <div className="mt-4 flex items-center text-sm">
                    <span className={`font-medium ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
                        {trend}
                    </span>
                    <span className="text-gray-400 ml-2">vs bulan lalu</span>
                </div>
            )}
        </div>
    );
}

function Card({ children, title, className = "", icon }: any) {
    return (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${className}`}>
            <div className="flex items-center gap-2 mb-6">
                {icon && <div className="text-gray-400">{icon}</div>}
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            </div>
            {children}
        </div>
    );
}
