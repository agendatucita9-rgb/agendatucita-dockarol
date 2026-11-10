import React, { useState, useEffect } from 'react';
import { User, Appointment, BlockedSlot, SystemSettings } from '../types';
import { Calendar } from './Calendar';
import { getAppointments, getBlockedSlots, saveAppointment, TIME_SLOTS, getSystemSettings } from '../store';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Calendar as CalendarIcon, Clock, MapPin, CreditCard, Info, X, ArrowLeft, Download, Stethoscope, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { DurationBadge } from './DurationBadge';
import { ProcedureIcon } from './ProcedureIcon';
import { CrioterapiaIcon } from './CrioterapiaIcon';
import { ElectrocirugiaIcon } from './ElectrocirugiaIcon';
import { PeelingQuimicoIcon } from './PeelingQuimicoIcon';
import { DermapenVitaminasIcon } from './DermapenVitaminasIcon';
import { DermapenExosomasIcon } from './DermapenExosomasIcon';
import { DermapenCapilarIcon } from './DermapenCapilarIcon';
import { LimpiezaFacialIcon } from './LimpiezaFacialIcon';
import { ReseccionPunchIcon } from './ReseccionPunchIcon';
import { PlasmaPenIcon } from './PlasmaPenIcon';
import { LogoIsotipoIcon } from './LogoIsotipoIcon';
import { KarolTalaveraSignatureIcon } from './KarolTalaveraSignatureIcon';

export interface ServiceItem {
  id: string;
  name: string;
  duration: number; // 1 or 2 hours
  category: 'consulta' | 'reconsulta' | 'procedimiento';
  description?: string;
}

export const SERVICES: ServiceItem[] = [
  { id: 'consulta', name: 'Consulta dermatológica', duration: 1, category: 'consulta', description: 'Evaluación dermatológica integral y diagnóstico' },
  { id: 'reconsulta', name: 'Reconsulta dermatológica', duration: 1, category: 'reconsulta', description: 'Control de seguimiento y evaluación de tratamiento' },
  { id: 'crioterapia', name: 'Crioterapia', duration: 1, category: 'procedimiento', description: 'Tratamiento con nitrógeno líquido' },
  { id: 'electrocirugia', name: 'Electrocirugía', duration: 1, category: 'procedimiento', description: 'Eliminación de lesiones cutáneas por corriente eléctrica' },
  { id: 'peeling', name: 'Peeling químico', duration: 1, category: 'procedimiento', description: 'Renovación celular y exfoliación química' },
  { id: 'dermapen_vitaminas', name: 'Dermapen con vitaminas', duration: 2, category: 'procedimiento', description: 'Microneedling con cóctel vitamínico' },
  { id: 'dermapen_exosomas', name: 'Dermapen con exosomas', duration: 2, category: 'procedimiento', description: 'Rejuvenecimiento celular avanzado con exosomas' },
  { id: 'dermapen_capilar', name: 'Dermapen capilar con exosomas', duration: 2, category: 'procedimiento', description: 'Estimulación y tratamiento capilar' },
  { id: 'limpieza_facial', name: 'Limpieza facial profunda', duration: 2, category: 'procedimiento', description: 'Extracción, exfoliación e hidratación profunda' },
  { id: 'reseccion_punch', name: 'Resección con punch', duration: 1, category: 'procedimiento', description: 'Biopsia o escisión de lesiones en piel' },
  { id: 'plasma_pen', name: 'Plasma Pen', duration: 1, category: 'procedimiento', description: 'Rejuvenecimiento y retracción cutánea' },
];

export function ClientInterface() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [dobText, setDobText] = useState('');
  const [dobError, setDobError] = useState('');
  const [phone, setPhone] = useState('');
  
  const datePickerRef = React.useRef<HTMLInputElement>(null);

  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [showProceduresList, setShowProceduresList] = useState(false);
  const [showProceduresModal, setShowProceduresModal] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({ blockedDaysOfWeek: [], blockedHours: [], blockedSaturdayHours: [] });
  
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [isSharingImage, setIsSharingImage] = useState(false);

  // Helper to check slot status for given duration
  const getSlotStatus = (dateStr: string, time: string, duration: number = 1) => {
    const startIndex = TIME_SLOTS.indexOf(time);
    if (startIndex === -1 || startIndex + duration > TIME_SLOTS.length) return 'blocked';

    for (let i = 0; i < duration; i++) {
      const t = TIME_SLOTS[startIndex + i];
      if (blockedSlots.some(s => s.date === dateStr && s.time === 'ALL')) return 'blocked';
      if (blockedSlots.some(s => s.date === dateStr && s.time === t)) return 'blocked';
      if (systemSettings.blockedHours.includes(t)) return 'blocked';
      
      const dateObj = parseISO(dateStr);
      if (dateObj.getDay() === 6 && (systemSettings.blockedSaturdayHours || []).includes(t)) {
        return 'blocked';
      }

      const isBooked = appointments.some(a => {
        if (a.date !== dateStr) return false;
        const aDur = a.duration || 1;
        const aStart = TIME_SLOTS.indexOf(a.time);
        if (aStart === -1) return false;
        return startIndex + i >= aStart && startIndex + i < aStart + aDur;
      });
      if (isBooked) return 'booked';
    }

    return 'available';
  };

  // Days completely blocked or fully booked (no slots available for 1-hr duration)
  const blockedDays = React.useMemo(() => {
    const dates = new Set<string>();
    appointments.forEach(a => dates.add(a.date));
    blockedSlots.forEach(s => dates.add(s.date));

    const result: string[] = [];
    dates.forEach(dateStr => {
      if (blockedSlots.some(s => s.date === dateStr && s.time === 'ALL')) {
        result.push(dateStr);
        return;
      }

      const allSlotsOccupied = TIME_SLOTS.every(time => {
        const dateObj = parseISO(dateStr);
        const isSaturdayHourBlocked = dateObj.getDay() === 6 && (systemSettings.blockedSaturdayHours || []).includes(time);
        const isBlocked = blockedSlots.some(s => s.date === dateStr && s.time === time) || systemSettings.blockedHours.includes(time) || isSaturdayHourBlocked;
        const isBooked = appointments.some(a => {
          if (a.date !== dateStr) return false;
          const aDur = a.duration || 1;
          const aStart = TIME_SLOTS.indexOf(a.time);
          const tIdx = TIME_SLOTS.indexOf(time);
          return tIdx >= aStart && tIdx < aStart + aDur;
        });
        return isBlocked || isBooked;
      });

      if (allSlotsOccupied) {
        result.push(dateStr);
      }
    });
    return result;
  }, [appointments, blockedSlots, systemSettings]);

  // Days with at least one booking
  const bookedDays = React.useMemo(() => {
    const dates = new Set<string>();
    appointments.forEach(a => dates.add(a.date));
    return Array.from(dates);
  }, [appointments]);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      const apps = await getAppointments();
      const slots = await getBlockedSlots();
      const settings = await getSystemSettings();
      if (active) {
        setAppointments(apps);
        setBlockedSlots(slots);
        setSystemSettings(settings);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [bookingSuccess]);

  const handleDobTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDobError('');
    let val = e.target.value;
    let clean = val.replace(/\D/g, '');
    if (clean.length > 8) {
      clean = clean.substring(0, 8);
    }
    
    let formatted = '';
    if (clean.length > 0) {
      formatted += clean.substring(0, 2);
    }
    if (clean.length > 2) {
      formatted += '/' + clean.substring(2, 4);
    }
    if (clean.length > 4) {
      formatted += '/' + clean.substring(4, 8);
    }
    
    setDobText(formatted);

    if (clean.length === 8) {
      const day = clean.substring(0, 2);
      const month = clean.substring(2, 4);
      const year = clean.substring(4, 8);
      const parsed = `${year}-${month}-${day}`;
      const d = parseInt(day, 10);
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= new Date().getFullYear()) {
        setDob(parsed);
      }
    } else if (clean.length === 0) {
      setDob('');
    }
  };

  const handleDatePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDobError('');
    const dbVal = e.target.value;
    if (dbVal) {
      setDob(dbVal);
      const parts = dbVal.split('-');
      if (parts.length === 3) {
        setDobText(`${parts[2]}/${parts[1]}/${parts[0]}`);
      }
    }
  };

  const triggerDatePicker = () => {
    if (datePickerRef.current) {
      if (typeof datePickerRef.current.showPicker === 'function') {
        try {
          datePickerRef.current.showPicker();
        } catch (err) {
          datePickerRef.current.click();
        }
      } else {
        datePickerRef.current.click();
      }
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(dobText)) {
      setDobError('Formato incorrecto. Usa DD/MM/AAAA (ej. 25/08/1995)');
      return;
    }
    
    const parts = dobText.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    const dateObj = new Date(year, month - 1, day);
    const today = new Date();
    
    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() + 1 !== month ||
      dateObj.getDate() !== day
    ) {
      setDobError('La fecha ingresada no es válida.');
      return;
    }
    
    if (year < 1900 || dateObj > today) {
      setDobError('Por favor, ingresa un año de nacimiento real.');
      return;
    }
    
    const parsedDob = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    
    if (name.trim() && parsedDob && phone.trim()) {
      setDob(parsedDob);
      setUser({ name, dob: parsedDob, phone });
    }
  };

  const handleBook = async () => {
    if (!user || !selectedDate || !selectedTime || !selectedService) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const newAppointment: Appointment = {
      id: Math.random().toString(36).substring(7),
      patientName: user.name,
      patientDob: user.dob,
      patientPhone: user.phone,
      date: dateStr,
      time: selectedTime,
      serviceName: selectedService.name,
      duration: selectedService.duration
    };
    
    await saveAppointment(newAppointment);
    setBookingSuccess(true);
  };

  const resetBooking = () => {
    setBookingSuccess(false);
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedService(null);
    setShowProceduresList(false);
    setUser(null);
    setName('');
    setDob('');
    setDobText('');
    setDobError('');
    setPhone('');
  };

  // Login View
  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-stone-100 w-full max-w-md">
          <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <img src="/logo-sm.svg" alt="Isotipo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-center text-stone-800 mb-1">Reserva tu cita</h1>
          <p className="text-stone-500 text-xs sm:text-sm text-center mb-5 sm:mb-8">Completa tus datos para continuar</p>
          
          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-stone-700 mb-0.5 sm:mb-1">Nombre Completo</label>
              <input 
                type="text" 
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors text-sm"
                placeholder="Ej. Ana García"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-stone-700 mb-0.5 sm:mb-1">Fecha de Nacimiento</label>
              <div className="relative">
                <input 
                  type="text" 
                  required
                  value={dobText}
                  onChange={handleDobTextChange}
                  maxLength={10}
                  className={cn(
                    "w-full pl-3 sm:pl-4 pr-12 py-2 sm:py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors text-sm",
                    dobError && "border-red-300 focus:ring-red-500/20 focus:border-red-500"
                  )}
                  placeholder="DD/MM/AAAA"
                />
                <button
                  type="button"
                  onClick={triggerDatePicker}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors p-1.5 rounded-lg hover:bg-stone-50"
                  title="Abrir calendario"
                >
                  <CalendarIcon size={18} />
                </button>
                <input
                  type="date"
                  ref={datePickerRef}
                  value={dob}
                  onChange={handleDatePickerChange}
                  className="sr-only absolute pointer-events-none"
                  tabIndex={-1}
                />
              </div>
              {dobError ? (
                <p className="mt-1 text-xs text-red-500 font-medium">{dobError}</p>
              ) : (
                <p className="mt-1 text-[10px] sm:text-[11px] text-stone-400">Puedes escribirla (ej. 25/08/1995) o usar el calendario.</p>
              )}
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-stone-700 mb-0.5 sm:mb-1">Teléfono</label>
              <input 
                type="tel" 
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors text-sm"
                placeholder="Ej. 77712345"
              />
            </div>
            <button 
              type="submit"
              className="w-full py-2.5 sm:py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors mt-3 sm:mt-4 text-sm"
            >
              Continuar
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Service Selection View (Step 2: 3 options with #e5aca5 background and procedures modal)
  if (!selectedService) {
    const consultaService = SERVICES.find(s => s.id === 'consulta')!;
    const reconsultaService = SERVICES.find(s => s.id === 'reconsulta')!;
    const proceduresList = SERVICES.filter(s => s.category === 'procedimiento');

    return (
      <div className="min-h-screen" style={{ backgroundColor: '#e5aca5' }}>
        <header className="bg-white/95 backdrop-blur-sm border-b border-stone-100 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 sm:h-10 flex items-center justify-center">
                <img src="/logo-sm.svg" alt="Logo" className="h-full w-auto object-contain sm:hidden" />
                <img src="/logo.svg" alt="Logo" className="h-full w-auto object-contain hidden sm:block" />
              </div>
              <span className="font-medium text-stone-800 hidden sm:block border-l border-stone-200 pl-3 text-sm">Hola, {user.name.split(' ')[0]}</span>
            </div>
            <button 
              onClick={() => setUser(null)}
              className="flex items-center gap-1.5 text-xs sm:text-sm text-stone-600 hover:text-stone-900 transition-colors font-medium bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl shadow-xs"
            >
              <ArrowLeft size={16} />
              Regresar
            </button>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 py-6 sm:py-10">
          <div className="text-center mb-6 sm:mb-8 text-white">
            <h1 className="text-xl sm:text-2xl font-bold mb-1 drop-shadow-xs">Selecciona el tipo de atención</h1>
            <p className="text-white/90 text-xs sm:text-sm">Elige el servicio o procedimiento que necesitas realizarte</p>
          </div>

          <div className="space-y-4 sm:space-y-5">
            {/* Card 1: Consulta dermatológica */}
            <button
              onClick={() => setSelectedService(consultaService)}
              className="w-full text-left bg-white p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-3 sm:gap-4 group border border-white/50"
            >
              <div className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
                <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform" style={{ backgroundColor: '#e5aca5' }}>
                  <Stethoscope size={28} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-stone-900 text-base sm:text-lg group-hover:text-brand-700 transition-colors leading-tight">
                    {consultaService.name}
                  </h3>
                  <p className="text-stone-500 text-xs sm:text-sm mt-1 line-clamp-2">{consultaService.description}</p>
                </div>
              </div>
              <DurationBadge duration={1} />
            </button>

            {/* Card 2: Reconsulta dermatológica */}
            <button
              onClick={() => setSelectedService(reconsultaService)}
              className="w-full text-left bg-white p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-3 sm:gap-4 group border border-white/50"
            >
              <div className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
                <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform" style={{ backgroundColor: '#c89582' }}>
                  <Clock size={28} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-stone-900 text-base sm:text-lg group-hover:text-brand-700 transition-colors leading-tight">
                    {reconsultaService.name}
                  </h3>
                  <p className="text-stone-500 text-xs sm:text-sm mt-1 line-clamp-2">{reconsultaService.description}</p>
                </div>
              </div>
              <DurationBadge duration={1} />
            </button>

            {/* Card 3: Procedimientos (Opens Mosaic Modal) */}
            <button
              onClick={() => setShowProceduresModal(true)}
              className="w-full text-left bg-white p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-3 sm:gap-4 group border border-white/50"
            >
              <div className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
                <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform" style={{ backgroundColor: '#bf815e' }}>
                  <ProcedureIcon className="w-8 h-8 sm:w-11 sm:h-11 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-stone-900 text-base sm:text-lg group-hover:text-brand-700 transition-colors leading-tight">
                    Procedimientos
                  </h3>
                  <p className="text-stone-500 text-xs sm:text-sm mt-1 line-clamp-2">Crioterapia, Electrocirugía, Peeling, Dermapen y más</p>
                </div>
              </div>
              <DurationBadge duration="1-2" unit="HORAS" />
            </button>
          </div>
        </main>

        {/* Procedures Mosaic Modal (Grid 2xN) */}
        {showProceduresModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-stone-50 rounded-3xl shadow-2xl border border-stone-200 w-full max-w-2xl sm:max-w-3xl md:max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-white px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-200 flex items-center justify-between sticky top-0 z-10">
                <div>
                  <h2 className="text-base sm:text-xl font-bold text-stone-900">Procedimientos dermatológicos</h2>
                  <p className="text-[11px] sm:text-xs text-stone-500">Selecciona el procedimiento que deseas realizarte</p>
                </div>
                <button
                  onClick={() => setShowProceduresModal(false)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-3 sm:p-5 md:p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:gap-5">
                  {proceduresList.map(proc => (
                    <button
                      key={proc.id}
                      onClick={() => {
                        setSelectedService(proc);
                        setShowProceduresModal(false);
                      }}
                      className="bg-white p-2.5 sm:p-4 rounded-[20px] sm:rounded-[28px] border border-[#e5aca5] hover:border-[#d99187] hover:shadow-md transition-all text-left flex flex-col justify-between group"
                    >
                      <div>
                        {/* 1. Large Centered Icon Container */}
                        <div className="flex justify-center mb-2 sm:mb-3">
                          <div
                            className="w-14 h-14 sm:w-20 sm:h-20 rounded-[16px] sm:rounded-[22px] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform"
                            style={{ backgroundColor: '#e5aca5' }}
                          >
                            {proc.id === 'crioterapia' ? (
                              <CrioterapiaIcon className="w-9 h-9 sm:w-12 sm:h-12 text-white" />
                            ) : proc.id === 'electrocirugia' ? (
                              <ElectrocirugiaIcon className="w-9 h-9 sm:w-12 sm:h-12 text-white" />
                            ) : proc.id === 'peeling' ? (
                              <PeelingQuimicoIcon className="w-9 h-9 sm:w-12 sm:h-12 text-white" />
                            ) : proc.id === 'dermapen_vitaminas' ? (
                              <DermapenVitaminasIcon className="w-9 h-9 sm:w-12 sm:h-12 text-white" />
                            ) : proc.id === 'dermapen_exosomas' ? (
                              <DermapenExosomasIcon className="w-9 h-9 sm:w-12 sm:h-12 text-white" />
                            ) : proc.id === 'dermapen_capilar' ? (
                              <DermapenCapilarIcon className="w-9 h-9 sm:w-12 sm:h-12 text-white" />
                            ) : proc.id === 'limpieza_facial' ? (
                              <LimpiezaFacialIcon className="w-9 h-9 sm:w-12 sm:h-12 text-white" />
                            ) : proc.id === 'reseccion_punch' ? (
                              <ReseccionPunchIcon className="w-9 h-9 sm:w-12 sm:h-12 text-white" />
                            ) : proc.id === 'plasma_pen' ? (
                              <PlasmaPenIcon className="w-9 h-9 sm:w-12 sm:h-12 text-white" />
                            ) : (
                              <ProcedureIcon className="w-9 h-9 sm:w-12 sm:h-12 text-white" />
                            )}
                          </div>
                        </div>

                        {/* 2. Middle Row: Compact Duration Badge + Procedure Name */}
                        <div className="flex items-center gap-1.5 sm:gap-2.5 px-0.5 min-w-0">
                          <DurationBadge duration={proc.duration} size="xs" className="shrink-0" />
                          <h4 className="font-semibold text-stone-800 text-[11px] sm:text-[13px] md:text-sm leading-tight group-hover:text-stone-950 transition-colors line-clamp-3 break-words flex-1 min-w-0">
                            {proc.name}
                          </h4>
                        </div>
                      </div>

                      {/* 3. Divider line + Centered 'Elegir' text */}
                      <div className="mt-2 sm:mt-3">
                        <div className="border-t border-[#e5aca5]/80 w-full" />
                        <div className="text-center pt-1.5 sm:pt-2">
                          <span className="text-xs sm:text-sm font-bold text-[#c4827b] group-hover:text-[#a85f57] transition-colors">
                            Elegir
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Booking Success View
  if (bookingSuccess) {
    const formatTimeTo12h = (timeStr: string | null) => {
      if (!timeStr) return '';
      const [hourStr, minuteStr] = timeStr.split(':');
      const hour = parseInt(hourStr, 10);
      const ampm = hour >= 12 ? 'p.m.' : 'a.m.';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minuteStr} ${ampm}`;
    };

    const formattedDateText = selectedDate ? (() => {
      const dateStr = format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es });
      const dayName = format(selectedDate, "EEEE", { locale: es }).toLowerCase();
      return `${dateStr} (${dayName})`;
    })() : '';

    const serviceDuration = selectedService?.duration || 1;
    const startIndex = TIME_SLOTS.indexOf(selectedTime || '');
    const endSlotTime = (startIndex !== -1 && startIndex + serviceDuration < TIME_SLOTS.length) 
      ? TIME_SLOTS[startIndex + serviceDuration] 
      : (selectedTime ? `${parseInt(selectedTime.split(':')[0]) + serviceDuration}:00` : '');

    const formattedTimeText = serviceDuration === 2 && selectedTime && endSlotTime
      ? `${selectedTime} a ${endSlotTime}`
      : formatTimeTo12h(selectedTime);

    const generateCanvasBlob = (mimeType: string = 'image/jpeg'): Promise<Blob> => {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const scale = 3; 
        const canvasW = 480;
        const canvasH = 500;
        canvas.width = canvasW * scale;
        canvas.height = canvasH * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo obtener el contexto del canvas'));
          return;
        }

        ctx.scale(scale, scale);

        const drawRoundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
          c.beginPath();
          c.moveTo(x + r, y);
          c.lineTo(x + w - r, y);
          c.quadraticCurveTo(x + w, y, x + w, y + r);
          c.lineTo(x + w, y + h - r);
          c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          c.lineTo(x + r, y + h);
          c.quadraticCurveTo(x, y + h, x, y + h - r);
          c.lineTo(x, y + r);
          c.quadraticCurveTo(x, y, x + r, y);
          c.closePath();
        };

        // Fill background with soft neutral color #F5F5F4
        ctx.fillStyle = '#F5F5F4';
        ctx.fillRect(0, 0, canvasW, canvasH);

        // Card Shadow
        ctx.shadowColor = 'rgba(120, 113, 108, 0.08)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 6;

        // Card Container
        const cardX = 20;
        const cardY = 20;
        const cardW = canvasW - 40;
        const cardH = canvasH - 40;
        ctx.fillStyle = '#FFFFFF';
        drawRoundRect(ctx, cardX, cardY, cardW, cardH, 24);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.strokeStyle = '#E7E5E4';
        ctx.lineWidth = 1.5;
        drawRoundRect(ctx, cardX, cardY, cardW, cardH, 24);
        ctx.stroke();

        const centerX = canvasW / 2;

        // 1. Draw Logo Isotipo on Canvas
        const p1 = new Path2D("M132.94,287.4a137.14,137.14,0,0,1-94.75-42.5,139.85,139.85,0,0,1-16.48-21A136.28,136.28,0,0,1,9.56,200.08,138.92,138.92,0,0,1,88.07,20.3a141.18,141.18,0,0,1,54.22-9.73,139.4,139.4,0,0,1,125.07,92.78,137.86,137.86,0,0,1-134.42,184m0-1.14a135.84,135.84,0,0,0,26.26-1.73A131.14,131.14,0,0,0,190.84,34.69a128.16,128.16,0,0,0-24-7.72,133,133,0,0,0-25-2.9,128.82,128.82,0,0,0-49.62,7.27A131.14,131.14,0,0,0,80.47,273.47a132.21,132.21,0,0,0,26.42,9.29,135.75,135.75,0,0,0,26.09,3.5");
        const p2 = new Path2D("M6.17,281.25a8,8,0,0,0,1.77-.72,16.18,16.18,0,0,0,1.62-.93c1-.65,2.07-1.33,3-2.06A70.41,70.41,0,0,0,18.2,273a97.4,97.4,0,0,0,9.64-9.74A105,105,0,0,0,42,242.2q2.78-5.44,5-11.15c.72-1.89,1.41-3.79,2-5.72l1-2.94c.33-1,.65-2.06,1-3.12,2.61-8.48,5.29-17.64,8.29-26.82S65.57,174,69.54,164.74a199.14,199.14,0,0,1,14-27.21,134.8,134.8,0,0,1,9.07-12.91,101.14,101.14,0,0,1,10.93-11.83,67.38,67.38,0,0,1,13.25-9.63,38,38,0,0,1,15.38-4.83,65.63,65.63,0,0,0-7.92,12.43A113,113,0,0,0,119,123.5c-3.06,8.6-5.48,17.39-7.9,26.28-4.75,17.83-9.3,36-15.23,54.56-.75,2.32-1.54,4.63-2.32,7s-1.65,4.66-2.5,7-1.8,4.7-2.74,7.08-2,4.76-3.1,7.17c-.56,1.2-1.13,2.41-1.73,3.64l-.45.91-.48,1c-.33.63-.65,1.26-1,1.89-.67,1.25-1.38,2.48-2.1,3.71s-1.5,2.43-2.28,3.62A90.45,90.45,0,0,1,66.4,260.65a77.91,77.91,0,0,1-28,18.67,63.11,63.11,0,0,1-16.07,3.84,48.94,48.94,0,0,1-8.21.11,32.71,32.71,0,0,1-4.07-.59c-.68-.15-1.34-.33-2-.54a7.34,7.34,0,0,1-1.85-.89");
        const p3 = new Path2D("M140.38,198.77c.58-.4,1.13-.8,1.66-1.23s1.05-.84,1.56-1.29c1-.87,2-1.72,3-2.64q2.88-2.67,5.53-5.41c3.54-3.67,6.82-7.38,9.91-11.2a80.65,80.65,0,0,0,8.09-12.2,111.79,111.79,0,0,0,6.08-13.15c1.75-4.48,3.32-9,4.84-13.41l1.09-3.15,1-3.05,2.1-6.54c1.44-4.5,3-9.21,4.62-14s3.48-9.65,5.31-14.58c3.72-9.83,7.8-19.84,12.61-29.71a190.22,190.22,0,0,1,17-28.8,132.8,132.8,0,0,1,10.84-13.17,103,103,0,0,1,12.75-11.5C257.48,6.88,268,1.67,278.83,0a118.09,118.09,0,0,0-10.5,11.85,110.77,110.77,0,0,0-8.28,12.53,170.28,170.28,0,0,0-12,26.68c-3.33,9.18-6.17,18.61-8.87,28.23s-5.26,19.42-8,29.42-5.75,20.22-10.48,30.65c-1.19,2.61-2.48,5.25-4,7.9q-1.11,2-2.35,4c-.43.66-.86,1.38-1.29,2l-1.3,1.77a110.73,110.73,0,0,1-11.6,13.25,152.15,152.15,0,0,1-13.27,11.45,162,162,0,0,1-14.26,9.71,72.15,72.15,0,0,1-15.45,7.13,53.29,53.29,0,0,1-8.27,2c-1.41.2-2.82.36-4.24.42a20.16,20.16,0,0,1-4.25-.2");
        const p4 = new Path2D("M94.3,208.83a7.26,7.26,0,0,1,1.61-.15,14.09,14.09,0,0,1,1.59.06c1,.08,2.07.19,3.1.36,2,.28,4,.73,6,1.19a84,84,0,0,1,11.07,3.56,89.13,89.13,0,0,1,18.9,10.32,102.56,102.56,0,0,1,8.1,6.44c1.28,1.14,2.55,2.3,3.78,3.5l1.87,1.84c.65.63,1.3,1.29,2,2,5.28,5.36,10.89,11.2,16.74,16.92s12,11.42,18.64,16.8a168.92,168.92,0,0,0,21.22,15,115.94,115.94,0,0,0,11.87,6.15,87.55,87.55,0,0,0,12.86,4.61,57,57,0,0,0,13.74,2.05,32.24,32.24,0,0,0,13.4-2.48A55.39,55.39,0,0,1,250,290.78a94.87,94.87,0,0,1-9-7.5c-5.71-5.28-11-10.93-16.29-16.68-10.56-11.54-21.11-23.44-32.84-35.06-1.46-1.45-3-2.88-4.47-4.33s-3.07-2.86-4.63-4.3-3.2-2.83-4.84-4.25-3.37-2.8-5.14-4.18c-.89-.69-1.8-1.37-2.73-2.06l-.69-.51-.74-.53c-.49-.34-1-.69-1.49-1-1-.68-2-1.33-3-2s-2.08-1.24-3.14-1.83a76,76,0,0,0-13.3-5.84,66.22,66.22,0,0,0-28.39-3.06,53.64,53.64,0,0,0-13.6,3.42,41.51,41.51,0,0,0-6.21,3.13,28.4,28.4,0,0,0-2.84,2c-.44.38-.88.77-1.29,1.19a6.27,6.27,0,0,0-1,1.4");

        ctx.save();
        const logoTargetW = 68;
        const logoScale = logoTargetW / 278.82;
        const logoTargetH = 299.49 * logoScale;
        ctx.translate(centerX - logoTargetW / 2, 78 - logoTargetH / 2);
        ctx.scale(logoScale, logoScale);

        ctx.fillStyle = '#434547';
        ctx.fill(p1);
        ctx.fillStyle = '#BF815E';
        ctx.fill(p2);
        ctx.fillStyle = '#DC968A';
        ctx.fill(p3);
        ctx.fillStyle = '#C89581';
        ctx.fill(p4);
        ctx.restore();

        // 2. Title "¡Cita Confirmada!"
        ctx.fillStyle = '#1C1917';
        ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('¡Cita Confirmada!', centerX, 142);

        // 3. Details Container (#faf2f2)
        const boxX = 42;
        const boxY = 165;
        const boxW = canvasW - 84;
        const boxH = 195;
        ctx.fillStyle = '#faf2f2';
        drawRoundRect(ctx, boxX, boxY, boxW, boxH, 16);
        ctx.fill();

        ctx.fillStyle = '#1C1917';
        ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Detalles de tu reserva:', centerX, 198);

        const labelLeftX = boxX + 24;
        const valRightX = boxX + boxW - 24;

        const drawDetailRow = (label: string, value: string, y: number) => {
          ctx.fillStyle = '#78716C';
          ctx.font = '500 13px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(label, labelLeftX, y);

          ctx.fillStyle = '#1C1917';
          ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(value, valRightX, y);
        };

        const drawDivider = (y: number) => {
          ctx.strokeStyle = '#f4e3e3';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(labelLeftX, y);
          ctx.lineTo(valRightX, y);
          ctx.stroke();
        };

        drawDetailRow('Servicio:', selectedService?.name || 'Consulta', 238);
        drawDivider(254);
        drawDetailRow('Fecha:', formattedDateText, 288);
        drawDivider(304);
        drawDetailRow('Hora:', formattedTimeText, 338);

        // 4. Karol Talavera Signature Logo at bottom
        const sigPaths = [
          "M7.7,12.3l-0.6-0.9C5.8,9.3,4.8,7.7,4,6.6C3.3,7,2.5,7.4,1.7,7.7v4.6H0V0.8h1.7v5.8C3.1,6,4.3,5.2,5.3,4.2c0.9-0.9,1.6-2.1,1.8-3.4h1.8c-0.2,1-0.6,1.9-1.2,2.6C7.1,4.3,6.3,5.1,5.3,5.8c0.7,1,1.4,2.1,2.1,3.1s1.6,2.2,2.4,3.4H7.7z",
          "M19.3,6c1.5,3.4,2.4,5.5,2.8,6.3H20c-0.4-0.9-0.7-1.7-1-2.6l-0.2-0.5h-5.1c-0.4,1.2-0.9,2.2-1.2,3H11l0.7-1.6c0.2-0.6,0.8-1.9,1.6-3.9s1.6-3.7,2.2-5.2c-0.1,0-0.2-0.1-0.3-0.2c-0.1-0.1-0.1-0.3-0.1-0.5h1.6c0.2,0,0.3,0.1,0.4,0.2L19.3,6z M18.4,8.1l-0.9-2.3L17,4.5c-0.3-0.7-0.5-1.3-0.7-1.8c-0.3,0.9-0.8,2.2-1.5,3.9c-0.4,1-0.6,1.5-0.6,1.5L18.4,8.1z",
          "M30.4,12.3c-0.1-0.2-0.5-0.9-1.1-2S28.1,8.4,27.9,8H25v4.2h-1.7V0.8h3.8c0.9,0,1.8,0.1,2.6,0.5c0.6,0.2,1.2,0.7,1.6,1.2c0.4,0.6,0.6,1.3,0.6,2c0,0.7-0.2,1.4-0.6,2c-0.5,0.6-1.1,1-1.8,1.2c0.4,0.7,1,1.6,1.6,2.7c0.4,0.7,0.8,1.3,1.2,1.9L30.4,12.3z M27.1,7c0.8,0.1,1.6-0.2,2.2-0.6c0.5-0.4,0.8-1.1,0.8-1.8c0.1-0.8-0.2-1.5-0.8-2c-0.7-0.5-1.5-0.8-2.3-0.7h-1.2c-0.2,0-0.4,0-0.6,0.1C25.1,2,25,2.1,25,2.2v4.6c0.4,0.1,0.9,0.2,1.3,0.2L27.1,7z",
          "M35.9,11.7c-0.9-0.5-1.6-1.2-2.1-2.1c-0.5-0.9-0.8-1.9-0.8-3c0-1,0.3-2.1,0.8-3C34.3,2.7,35,2,35.9,1.5c1.8-1,4.1-1,5.9,0c0.9,0.5,1.6,1.2,2.1,2.1c1,1.9,1,4.2,0,6.1c-0.5,0.9-1.2,1.6-2.1,2.1c-1.9,1-4.1,1-6,0 M40.9,11c0.6-0.4,1.1-0.9,1.4-1.5c0.3-0.7,0.5-1.5,0.5-2.2c0-1-0.2-1.9-0.5-2.8c-0.3-0.8-0.8-1.4-1.5-1.9c-0.6-0.5-1.4-0.7-2.2-0.7c-0.7,0-1.4,0.2-2,0.5c-0.6,0.3-1.1,0.9-1.4,1.5c-0.3,0.7-0.5,1.4-0.5,2.1c0,1,0.2,1.9,0.5,2.8c0.3,0.8,0.8,1.5,1.5,2c0.6,0.5,1.4,0.7,2.2,0.7C39.6,11.5,40.3,11.4,40.9,11",
          "M46.1,12.3V0.8h1.7V11c0.4,0.1,0.8,0.1,1.2,0.1c2.5,0,3.9,0,4.3-0.1v1.2L46.1,12.3z",
          "M71,1.2h-3.5v10.4h-1.7V1.2c-1.2,0-2.3,0-3.5,0V0.1H71V1.2z",
          "M77.6,5.3c1.5,3.4,2.4,5.5,2.8,6.3h-2.1c-0.4-0.9-0.7-1.7-1-2.6l-0.2-0.5H72c-0.4,1.1-0.8,2.2-1.2,3h-1.6L70,9.9L71.6,6c0.8-2,1.6-3.8,2.2-5.3c-0.1,0-0.2-0.1-0.3-0.2c-0.1-0.1-0.1-0.3-0.1-0.5H75c0.2,0,0.3,0.1,0.4,0.2L77.6,5.3z M76.7,7.4l-0.9-2.3l-0.6-1.3C75,3.2,74.7,2.6,74.5,2c-0.3,0.9-0.8,2.2-1.5,3.9l-0.6,1.5L76.7,7.4z",
          "M81.8,11.5V0h1.7v10.2c0.4,0.1,0.8,0.1,1.2,0.1c2.4,0,3.9,0,4.3-0.1v1.2H81.8z",
          "M98.6,5.3c1.5,3.4,2.4,5.5,2.8,6.3h-2c-0.4-0.9-0.7-1.7-1-2.6l-0.2-0.5H93c-0.5,1.1-0.8,2.2-1.2,3h-1.5L91,9.9L92.7,6c0.8-2,1.6-3.8,2.2-5.3c-0.1,0-0.3-0.1-0.3-0.3c-0.1-0.1-0.1-0.3-0.1-0.4h1.6c0.1,0,0.3,0,0.4,0.2L98.6,5.3z M97.7,7.4l-0.9-2.3c-0.1-0.5-0.3-0.9-0.6-1.3C95.9,3,95.7,2.4,95.6,2c-0.3,0.9-0.8,2.2-1.5,3.9l-0.6,1.5L97.7,7.4z",
          "M101.9,0.1l1,2.6l2.7,6.8c0.6-1.6,1.3-3.4,2-5.4c0.9-2.2,1.4-3.6,1.6-4h1.6c-0.3,0.6-0.9,2-1.8,4.2s-1.9,4.6-2.9,7.3h-1.3c-0.8-1.9-1.7-4.1-2.9-6.8S100,0.5,99.8,0L101.9,0.1z",
          "M117.6,10.4c0.6,0,1.3,0,1.9-0.1v1.2h-7.7V0h7.4v1.2c-1.1,0-2.9-0.1-5.2-0.1c-0.3,0-0.4,0.1-0.4,0.2V5h0.8c0.8,0,2.1,0,3.8-0.1v1.3h-4.6v4.1c0.4,0.1,0.9,0.1,1.3,0.1L117.6,10.4",
          "M127.9,11.6c-0.1-0.2-0.5-0.9-1.2-2s-1.1-1.9-1.4-2.3h-2.9v4.2h-1.7V0h3.8c0.9,0,1.8,0.1,2.6,0.5c0.7,0.3,1.2,0.7,1.6,1.3c0.4,0.6,0.6,1.2,0.6,1.9c0,0.7-0.2,1.4-0.6,2c-0.4,0.6-1.1,1.1-1.8,1.3l1.6,2.6c0.7,1.1,1.1,1.7,1.2,1.9H127.9z M124.7,6.3c0.8,0,1.6-0.2,2.2-0.6c0.5-0.4,0.8-1.1,0.8-1.8c0.1-0.8-0.2-1.5-0.8-2-0.7-0.5-1.5-0.7-2.3-0.7h-1.2c-0.2,0-0.4,0-0.6,0.1c-0.1,0-0.2,0.1-0.2,0.3v4.6c0.4,0.1,0.9,0.2,1.3,0.2L124.7,6.3z",
          "M139.4,5.3c1.5,3.4,2.4,5.5,2.8,6.3h-2.1c-0.4-0.9-0.7-1.7-1-2.6l-0.2-0.5h-5.1c-0.4,1.2-0.9,2.2-1.2,3h-1.5l0.7-1.6c0.2-0.6,0.8-1.9,1.6-3.9s1.6-3.7,2.2-5.3c-0.1,0-0.2-0.1-0.3-0.3c-0.1-0.1-0.1-0.3-0.1-0.4h1.6c0.2,0,0.3,0,0.4,0.2L139.4,5.3z M138.5,7.4l-0.9-2.3c-0.1-0.1-0.2-0.6-0.6-1.3s-0.6-1.3-0.7-1.8c-0.3,0.9-0.8,2.2-1.5,3.9l-0.6,1.5L138.5,7.4z",
          "M41,18.4c0.1,1.3-1,2.4-2.3,2.5c0,0,0,0,0,0h-1.5c0,0-0.1,0-0.1-0.1c0,0,0,0,0,0l0,0V16c0,0,0-0.1,0.1-0.1c0,0,0,0,0,0h1.2c1.3-0.1,2.5,0.8,2.6,2.1c0,0,0,0,0,0C41,18.2,41,18.3,41,18.4z M40.3,18.4c0.1-0.9-0.6-1.8-1.5-1.9c-0.1,0-0.3,0-0.4,0h-0.6v3.7h0.6c0.9,0.1,1.8-0.5,1.9-1.5c0,0,0,0,0,0C40.3,18.7,40.3,18.6,40.3,18.4L40.3,18.4z",
          "M46.6,20.4v0.4c0,0.1,0,0.1-0.1,0.1h-3c-0.1,0-0.1,0-0.1-0.1c0,0,0,0,0,0l0,0V16c0-0.1,0-0.1,0.1-0.1h3.1c0.1,0,0.1,0,0.1,0.1l0,0v0.4c0,0,0,0.1-0.1,0.1l0,0H44V18h2.3c0.1,0,0.1,0,0.1,0.1l0,0v0.4c0,0.1,0,0.1-0.1,0.1H44v1.7h2.5C46.6,20.3,46.6,20.3,46.6,20.4C46.6,20.4,46.6,20.4,46.6,20.4L46.6,20.4L46.6,20.4z",
          "M52.6,20.8c0,0.1,0,0.1-0.1,0.1H52c-0.1,0-0.1,0-0.1-0.1L51,19.1h-1.3v1.7c0,0.1,0,0.1-0.1,0.1c0,0,0,0,0,0h-0.5c-0.1,0-0.1,0-0.1-0.1l0,0V16c0,0,0-0.1,0.1-0.1c0,0,0,0,0,0h1.8c1.3,0,1.8,0.5,1.8,1.5c0.1,0.7-0.3,1.3-1,1.5L52.6,20.8z M49.7,18.5h1.2c0.7,0,1.1-0.2,1.1-1s-0.4-1-1.1-1h-1.2V18.5z",
          "M60.1,16.1v4.8c0,0.1,0,0.1,0,0.1c0,0,0,0,0,0h-0.5c-0.1,0-0.1,0-0.1-0.1l0,0v-3.6l-1.5,3.6c0,0.1-0.1,0.1-0.1,0.1h-0.5c0,0-0.1,0-0.1-0.1c0,0,0,0,0,0l0,0l-1.5-3.6v3.6c0,0.1,0,0.1-0.1,0.1c0,0,0,0,0,0h-0.5c-0.1,0-0.1,0-0.1-0.1c0,0,0,0,0,0l0,0v-4.8c0-0.1,0-0.1,0.1-0.1h0.6c0.1,0,0.1,0,0.1,0.1l1.7,4.1l1.7-4.1c0,0,0.1-0.1,0.1,0L60.1,16.1C60.1,16,60.1,16,60.1,16.1C60.1,16.1,60.1,16.1,60.1,16.1L60.1,16.1z",
          "M66.6,20.9h-0.5c0,0-0.1,0-0.1-0.1l-0.3-1h-2.3l-0.4,1c0,0.1-0.1,0.1-0.1,0.1h-0.5c-0.1,0-0.1-0.1-0.1-0.1l1.8-4.8c0-0.1,0.1-0.1,0.1-0.1h0.4c0.1,0,0.1,0,0.1,0.1l1.8,4.8C66.7,20.8,66.7,20.9,66.6,20.9L66.6,20.9z M65.4,19.3l-0.9-2.5l-0.9,2.5L65.4,19.3z",
          "M72,16.1v0.4c0,0,0,0.1-0.1,0.1h-1.5v4.2c0,0.1,0,0.1-0.1,0.1c0,0,0,0,0,0h-0.5c-0.1,0-0.1,0-0.1-0.1l0,0v-4.3h-1.5c0,0-0.1,0-0.1-0.1l0,0v-0.4c0-0.1,0-0.1,0.1-0.1h3.6C71.9,16,71.9,16,72,16.1L72,16.1z",
          "M74,18.5c0-1.4,1.1-2.5,2.6-2.5c1.4,0,2.5,1.1,2.5,2.6c0,1.4-1.1,2.5-2.6,2.5c0,0,0,0,0,0C75.1,21,74,19.9,74,18.5C74,18.5,74,18.5,74,18.5z M78.4,18.5c0-1-0.9-1.9-1.9-1.8c-1,0-1.9,0.9-1.8,1.9c0,1,0.9,1.9,1.9,1.8C77.6,20.4,78.4,19.5,78.4,18.5z",
          "M84.7,20.4v0.4c0,0.1,0,0.1-0.1,0.1h-3c-0.1,0-0.1,0-0.1-0.1l0,0V16c0,0,0-0.1,0.1-0.1c0,0,0,0,0,0H82c0,0,0.1,0,0.1,0.1c0,0,0,0,0,0l0,0v4.3h2.4c0,0,0.1,0,0.1,0.1L84.7,20.4z",
          "M86.7,18.5c0-1.4,1.1-2.5,2.5-2.5c1.4,0,2.5,1.1,2.5,2.5c0,1.4-1.1,2.5-2.5,2.5C87.9,21,86.7,19.9,86.7,18.5C86.7,18.5,86.7,18.5,86.7,18.5z M91.1,18.5c0-1.1-0.9-1.9-1.9-1.9s-1.9,0.9-1.9,1.9s0.9,1.9,1.9,1.9C90.3,20.4,91.1,19.5,91.1,18.5L91.1,18.5z M89.9,14.6l-0.4,0.9c0,0.1-0.1,0.1-0.1,0.1h-0.3c-0.1,0-0.1,0-0.1-0.1l0.4-0.9c0,0,0.1,0,0.1,0L89.9,14.6C90,14.6,90,14.6,89.9,14.6L89.9,14.6z",
          "M98.9,18.4v0.3c0.1,1.2-0.8,2.2-2,2.3h-0.2c-1.4-0.1-2.5-1.3-2.4-2.7c0.1-1.3,1.1-2.3,2.4-2.4c0.6,0,1.2,0.2,1.7,0.7v0.1l0,0L98,17h-0.1c-0.3-0.3-0.8-0.5-1.2-0.5c-1.1,0.1-1.8,1-1.8,2c0.1,0.9,0.8,1.7,1.8,1.8c0.8,0.1,1.5-0.5,1.6-1.3v-0.1h-1.6c0,0-0.1,0-0.1-0.1l0,0v-0.4c0-0.1,0-0.1,0.1-0.1h2.1C98.9,18.3,98.9,18.3,98.9,18.4L98.9,18.4L98.9,18.4z",
          "M105,20.9h-0.4c-0.1,0-0.1,0-0.1-0.1c0,0,0,0,0,0l-0.3-1h-2.3l-0.3,1c0,0.1-0.1,0.1-0.1,0.1h-0.5c0,0-0.1,0-0.1-0.1c0,0,0,0,0-0.1l1.8-4.8c0-0.1,0.1-0.1,0.1-0.1h0.4c0.1,0,0.1,0,0.1,0.1l1.8,4.8C105.1,20.9,105.1,20.9,105,20.9z M103.9,19.3l-0.9-2.5l-1,2.5H103.9z"
        ];

        ctx.save();
        const sigTargetW = 180;
        const sigScale = sigTargetW / 142.2;
        const sigY = 412;
        ctx.translate(centerX - sigTargetW / 2, sigY);
        ctx.scale(sigScale, sigScale);

        ctx.fillStyle = '#444548';
        sigPaths.forEach(pathStr => {
          ctx.fill(new Path2D(pathStr));
        });
        ctx.restore();

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('No se pudo generar la imagen'));
          }
        }, mimeType as any, 0.95);
      });
    };

    const handleShareOrDownload = async () => {
      if (isSharingImage) return;
      setIsSharingImage(true);
      try {
        const blob = await generateCanvasBlob('image/png');
        const file = new File([blob], 'comprobante_cita.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Mi Cita Dermatológica',
            text: `Dra. Karol Talavera: adjunto la confirmación de mi cita`,
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `comprobante_cita_${user?.name.trim().replace(/\s+/g, '_') || 'reserva'}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error('Error al generar o compartir el comprobante:', error);
      } finally {
        setIsSharingImage(false);
      }
    };

    const handleDownloadJpg = async () => {
      if (isSharingImage) return;
      setIsSharingImage(true);
      try {
        const blob = await generateCanvasBlob('image/jpeg');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comprobante_cita_${user?.name.trim().replace(/\s+/g, '_') || 'reserva'}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error al descargar el comprobante en JPG:', error);
      } finally {
        setIsSharingImage(false);
      }
    };

    return (
      <div className="min-h-screen bg-stone-50 p-4 flex items-center justify-center animate-in fade-in duration-300">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-stone-100 w-full max-w-md text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-5 flex items-center justify-center">
            <LogoIsotipoIcon className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl font-semibold text-stone-800 mb-6">¡Cita Confirmada!</h2>
          
          <div className="text-stone-600 mb-6 p-5 rounded-2xl" style={{ backgroundColor: '#faf2f2' }}>
            <p className="font-semibold text-stone-800 mb-3 text-center text-sm">Detalles de tu reserva:</p>
            
            <div className="max-w-[320px] mx-auto space-y-3 text-left">
              <div className="flex justify-between items-center text-xs sm:text-sm border-b border-[#f4e3e3] pb-2 gap-4">
                <span className="text-stone-500 font-medium">Servicio:</span>
                <span className="font-semibold text-stone-800 text-right">{selectedService?.name}</span>
              </div>
              
              <div className="flex justify-between items-center text-xs sm:text-sm border-b border-[#f4e3e3] pb-2 gap-4">
                <span className="text-stone-500 font-medium">Fecha:</span>
                <span className="font-semibold text-stone-800 text-right">
                  {formattedDateText}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-xs sm:text-sm gap-4">
                <span className="text-stone-500 font-medium">Hora:</span>
                <span className="font-semibold text-stone-800 text-right">
                  {formattedTimeText}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={handleShareOrDownload}
              disabled={isSharingImage}
              style={{ backgroundColor: '#4d4e51' }}
              className="w-full py-3 px-4 hover:opacity-90 disabled:opacity-50 text-white font-medium rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm"
            >
              {isSharingImage ? 'Generando imagen...' : (navigator.share ? 'Compartir confirmación de cita' : 'Descargar Imagen / Screenshot')}
            </button>

            <button 
              onClick={handleDownloadJpg}
              disabled={isSharingImage}
              className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
            >
              <Download size={16} />
              {isSharingImage ? 'Generando JPG...' : 'Descarga tu cita'}
            </button>

            <div className="pt-3 pb-1 flex flex-col items-center gap-2">
              <KarolTalaveraSignatureIcon className="w-40 sm:w-48 h-auto opacity-85 hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 sm:h-10 flex items-center justify-center">
              <img src="/logo-sm.svg" alt="Logo" className="h-full w-auto object-contain sm:hidden" />
              <img src="/logo.svg" alt="Logo" className="h-full w-auto object-contain hidden sm:block" />
            </div>
            <span className="font-medium text-stone-800 hidden sm:block border-l border-stone-200 pl-3 text-sm">Hola, {user.name.split(' ')[0]}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => {
                setSelectedService(null);
                setSelectedDate(null);
                setSelectedTime(null);
              }}
              className="flex items-center gap-1.5 text-xs sm:text-sm text-stone-600 hover:text-stone-900 transition-colors font-medium bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-xl shadow-xs"
            >
              <ArrowLeft size={16} />
              Regresar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-3 sm:py-8">
        <div className="mb-3 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-2xl font-semibold text-stone-800">Reserva tu cita</h1>
            <p className="text-stone-500 text-xs sm:text-sm mt-0.5">
              Servicio: <strong className="text-stone-700">{selectedService?.name}</strong> ({selectedService?.duration} {selectedService?.duration === 1 ? 'hora' : 'horas'})
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 sm:gap-8 items-start">
          {/* Calendar Section */}
          <div className={cn("md:block", selectedDate ? "hidden" : "block")}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <section>
                <div className="flex items-center gap-2 mb-2 sm:mb-4 text-stone-700 text-xs sm:text-sm font-medium px-1">
                  <CalendarIcon size={16} className="text-brand-600" />
                  1. Selecciona una fecha
                </div>
                <Calendar 
                  selectedDate={selectedDate} 
                  onSelectDate={(date) => {
                    setSelectedDate(date);
                    setSelectedTime(null);
                  }} 
                  blockedDays={blockedDays}
                  bookedDays={bookedDays}
                  blockedDaysOfWeek={systemSettings.blockedDaysOfWeek}
                />
              </section>
            </motion.div>
          </div>

          {/* Time Selection Section */}
          <div className={cn("md:block", selectedDate ? "block" : "hidden")}>
            <motion.div
              key={selectedDate ? selectedDate.toISOString() : 'no-date'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <section>
                <div className="flex items-center justify-between mb-2 sm:mb-4 px-1 gap-4">
                  <div className="flex items-center gap-2 text-stone-700 text-xs sm:text-sm font-medium">
                    <Clock size={16} className="text-brand-600" />
                    2. Selecciona un horario disponible
                  </div>
                  {selectedDate && (
                    <button
                      onClick={() => {
                        setSelectedDate(null);
                        setSelectedTime(null);
                      }}
                      className="md:hidden text-[11px] text-brand-700 font-medium hover:text-brand-800 flex items-center gap-1 bg-brand-50 hover:bg-brand-100 py-1 px-2.5 rounded-lg border border-brand-100 transition-colors shrink-0"
                    >
                      <ArrowLeft size={13} />
                      Volver
                    </button>
                  )}
                </div>
                
                {!selectedDate ? (
                  <div className="bg-white rounded-2xl border border-stone-100 p-8 text-center text-stone-400 text-xs sm:text-sm">
                    Selecciona un día en el calendario para ver los horarios disponibles.
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-stone-100 p-4 sm:p-6">
                    <h3 className="text-stone-800 text-sm sm:text-base font-medium mb-3 sm:mb-4">
                      {(() => {
                        const str = format(selectedDate, "EEEE d 'de' MMMM", { locale: es });
                        return str.charAt(0).toUpperCase() + str.slice(1);
                      })()}
                    </h3>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                      {TIME_SLOTS.map((time, idx) => {
                        const dateStr = format(selectedDate, 'yyyy-MM-dd');
                        const duration = selectedService?.duration || 1;
                        const status = getSlotStatus(dateStr, time, duration);
                        const isAvailable = status === 'available';
                        const isSelected = selectedTime === time;

                        // If duration is 2, check if next slot exists in TIME_SLOTS
                        if (duration === 2 && idx + 1 >= TIME_SLOTS.length) {
                          return null; // Cannot start 2-hr procedure at the very last slot
                        }
                        
                        const endSlotTime = duration === 2 ? TIME_SLOTS[idx + 2] || '' : '';
                        const label = duration === 2 && endSlotTime ? `${time} a ${endSlotTime}` : time;

                        return (
                          <button
                            key={time}
                            disabled={!isAvailable}
                            onClick={() => setSelectedTime(time)}
                            className={cn(
                              "py-2 sm:py-3 px-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 border",
                              isAvailable && !isSelected && "bg-white border-stone-200 text-stone-700 hover:border-brand-500 hover:text-brand-700",
                              isSelected && "bg-brand-600 border-brand-600 text-white shadow-md shadow-brand-200",
                              !isAvailable && "bg-stone-50 border-stone-100 text-stone-400 cursor-not-allowed opacity-60"
                            )}
                          >
                            {label}
                            {!isAvailable && (
                              <span className="block text-[9px] font-normal mt-0.5 opacity-80">
                                Ocupado
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {selectedTime && (
                      <div className="mt-4 sm:mt-8 pt-3 sm:pt-6 border-t border-stone-100">
                        <button
                          onClick={handleBook}
                          className="w-full py-2.5 sm:py-3.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm sm:text-base font-medium rounded-lg sm:rounded-xl transition-all shadow-md shadow-brand-200/50 transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                          Confirmar mi cita
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </motion.div>
          </div>
        </div>

      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowInfoModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-stone-900 text-brand-400 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center z-40 border border-stone-700"
        aria-label="Información del consultorio"
      >
        <Info size={28} />
      </button>

      {/* Clinic Information Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-stone-900 px-5 py-3.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Info className="text-brand-400" size={20} />
                <h2 className="text-lg font-medium">Información del Consultorio</h2>
              </div>
              <button 
                onClick={() => setShowInfoModal(false)}
                className="text-stone-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-stone-800"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
              <div className="flex gap-3">
                <div className="w-8 h-8 shrink-0 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                  <MapPin size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-800 text-sm mb-1">Dirección</h3>
                  <div className="text-stone-600 text-xs leading-relaxed">
                    <p className="font-medium text-stone-800">Centro Médico Niño Jesús</p>
                    <p>Av. Cañoto Nº 580, Rafael Peña. Piso 5, consultorio 512.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 border-t border-stone-100 pt-4">
                <div className="w-8 h-8 shrink-0 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Clock size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-800 text-sm mb-1">Horarios</h3>
                  <div className="text-stone-600 text-xs leading-relaxed">
                    <p><span className="font-medium text-stone-800">Lun a Vie:</span> 09:00 - 12:00 m. | 15:00 - 20:00 hrs.</p>
                    <p><span className="font-medium text-stone-800">Sáb:</span> 09:00 - 12:00 m.</p>
                    <p className="mt-1 italic text-stone-500 text-[11px]">Se marca cita previamente para ser atendido.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 border-t border-stone-100 pt-4">
                <div className="w-8 h-8 shrink-0 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CreditCard size={16} />
                </div>
                <div className="w-full">
                  <h3 className="font-semibold text-stone-800 text-sm mb-1">Costos y Pagos</h3>
                  <div className="text-stone-600 text-xs leading-relaxed space-y-2">
                    <div>
                      <p className="font-medium text-stone-800">Consulta: <span className="text-emerald-700 font-semibold">250 bs.</span></p>
                      <p className="font-medium text-stone-800">Reconsulta (control): <span className="text-stone-700 font-semibold">50 bs.</span></p>
                    </div>
                    <div className="p-2 bg-stone-50 rounded-lg border border-stone-100">
                      <p className="text-[10px] font-medium text-stone-600 mb-0.5">Métodos de pago:</p>
                      <p className="text-[10px] text-stone-500">Efectivo, Código QR o Transferencia bancaria.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
