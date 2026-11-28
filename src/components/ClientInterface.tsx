import React, { useState, useEffect } from 'react';
import { User, Appointment, BlockedSlot, SystemSettings } from '../types';
import { Calendar } from './Calendar';
import { getAppointments, getBlockedSlots, saveAppointment, TIME_SLOTS, getSystemSettings } from '../store';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Calendar as CalendarIcon, Clock, MapPin, CreditCard, Info, X, ArrowLeft, Download, ChevronRight, Share2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { DurationBadge } from './DurationBadge';
import { ConsultaIcon } from './ConsultaIcon';
import { ReconsultaIcon } from './ReconsultaIcon';
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

export interface ServiceItem {
  id: string;
  name: string;
  duration: number; // 1 or 2 hours
  category: 'consulta' | 'reconsulta' | 'procedimiento';
  description?: string;
}

export const SERVICES: ServiceItem[] = [
  { id: 'consulta', name: 'Consulta dermatológica', duration: 1, category: 'consulta', description: 'Evaluación integral, diagnóstico y tratamiento' },
  { id: 'reconsulta', name: 'Reconsulta dermatológica', duration: 1, category: 'reconsulta', description: 'Seguimiento de la evolución y ajuste del tratamiento' },
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
          <h1 className="text-xl sm:text-2xl font-semibold text-center text-stone-800 mb-1">Reserve su cita</h1>
          <p className="text-stone-500 text-xs sm:text-sm text-center mb-5 sm:mb-8">Complete sus datos para continuar</p>
          
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
            <h1 className="text-xl sm:text-2xl font-bold drop-shadow-xs">Seleccione el tipo de atención que desea recibir</h1>
          </div>

          <div className="space-y-4 sm:space-y-5">
            {/* Card 1: Consulta dermatológica */}
            <button
              onClick={() => setSelectedService(consultaService)}
              className="w-full text-left bg-white p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-3 sm:gap-4 group border border-white/50"
            >
              <div className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
                <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform" style={{ backgroundColor: '#e5aca5' }}>
                  <ConsultaIcon className="w-11 h-11 sm:w-14 sm:h-14 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-stone-900 text-base sm:text-lg group-hover:text-brand-700 transition-colors leading-tight">
                    {consultaService.name}
                  </h3>
                  <p className="text-stone-500 text-xs sm:text-sm mt-1 line-clamp-2">{consultaService.description}</p>
                </div>
              </div>
            </button>

            {/* Card 2: Reconsulta dermatológica */}
            <button
              onClick={() => setSelectedService(reconsultaService)}
              className="w-full text-left bg-white p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-3 sm:gap-4 group border border-white/50"
            >
              <div className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
                <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform" style={{ backgroundColor: '#c89582' }}>
                  <ReconsultaIcon className="w-11 h-11 sm:w-14 sm:h-14 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-stone-900 text-base sm:text-lg group-hover:text-brand-700 transition-colors leading-tight">
                    {reconsultaService.name}
                  </h3>
                  <p className="text-stone-500 text-xs sm:text-sm mt-1 line-clamp-2">{reconsultaService.description}</p>
                </div>
              </div>
            </button>

            {/* Card 3: Procedimientos (Opens Mosaic Modal) */}
            <button
              onClick={() => setShowProceduresModal(true)}
              className="w-full text-left bg-white p-4 sm:p-5 rounded-[28px] sm:rounded-[32px] shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-3 sm:gap-4 group border border-white/50"
            >
              <div className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
                <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform" style={{ backgroundColor: '#bf815e' }}>
                  <ProcedureIcon className="w-11 h-11 sm:w-14 sm:h-14 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-stone-900 text-base sm:text-lg group-hover:text-brand-700 transition-colors leading-tight">
                    Procedimientos
                  </h3>
                  <p className="text-stone-500 text-xs sm:text-sm mt-1 line-clamp-2">Electrocirugía, crioterapia, peeling, limpieza facial, micropunción y más</p>
                </div>
              </div>
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
                  <p className="text-[11px] sm:text-xs text-stone-500">Seleccione el procedimiento de su preferencia</p>
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
                              <PeelingQuimicoIcon className="w-11 h-11 sm:w-[60px] sm:h-[60px] text-white" />
                            ) : proc.id === 'dermapen_vitaminas' ? (
                              <DermapenVitaminasIcon className="w-9 h-9 sm:w-12 sm:h-12 text-white" />
                            ) : proc.id === 'dermapen_exosomas' ? (
                              <DermapenExosomasIcon className="w-9 h-9 sm:w-12 sm:h-12 text-white" />
                            ) : proc.id === 'dermapen_capilar' ? (
                              <DermapenCapilarIcon className="w-9 h-9 sm:w-12 sm:h-12 text-white" />
                            ) : proc.id === 'limpieza_facial' ? (
                              <LimpiezaFacialIcon className="w-11 h-11 sm:w-[60px] sm:h-[60px] text-white" />
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

                      {/* 3. Rounded 'Seleccionar' button */}
                      <div className="mt-2.5 sm:mt-3.5">
                        <div className="w-full py-1.5 sm:py-2 px-3 rounded-xl sm:rounded-2xl bg-[#fdf2f1] border border-[#e5aca5]/80 group-hover:bg-[#e5aca5] group-hover:border-[#e5aca5] text-center transition-all shadow-2xs">
                          <span className="text-xs sm:text-sm font-bold text-[#c4827b] group-hover:text-white transition-colors">
                            Seleccionar
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
        const canvasW = 540;
        const canvasH = 580;
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
        ctx.shadowColor = 'rgba(120, 113, 108, 0.1)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 8;

        // Card Container
        const cardX = 24;
        const cardY = 24;
        const cardW = canvasW - 48;
        const cardH = canvasH - 48;
        ctx.fillStyle = '#FFFFFF';
        drawRoundRect(ctx, cardX, cardY, cardW, cardH, 28);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.strokeStyle = '#E7E5E4';
        ctx.lineWidth = 1.5;
        drawRoundRect(ctx, cardX, cardY, cardW, cardH, 28);
        ctx.stroke();

        const centerX = canvasW / 2;

        // 1. Title "¡Cita Confirmada!"
        ctx.fillStyle = '#1C1917';
        ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('¡Cita Confirmada!', centerX, 82);

        // 2. Details Container (#faf2f2)
        const boxX = 42;
        const boxY = 114;
        const boxW = canvasW - 84;
        const boxH = 220;
        ctx.fillStyle = '#faf2f2';
        drawRoundRect(ctx, boxX, boxY, boxW, boxH, 20);
        ctx.fill();

        ctx.fillStyle = '#1C1917';
        ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Detalles de su reserva:', centerX, 150);

        const labelLeftX = boxX + 28;
        const valRightX = boxX + boxW - 28;

        const drawDetailRow = (label: string, value: string, y: number) => {
          ctx.fillStyle = '#78716C';
          ctx.font = '500 14px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(label, labelLeftX, y);

          ctx.fillStyle = '#1C1917';
          ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
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

        drawDetailRow('Servicio:', selectedService?.name || 'Consulta', 198);
        drawDivider(218);
        drawDetailRow('Fecha:', formattedDateText, 256);
        drawDivider(276);
        drawDetailRow('Hora:', formattedTimeText, 314);

        // 3. Main Logo (Dra. Karol Talavera Dermatóloga) at bottom matching /public/logo.svg (viewBox 0 0 793.8 299.4)
        const p1 = new Path2D("M132.9,287.4c-35.9-1.2-70-16.5-94.8-42.5c-6.1-6.5-11.7-13.5-16.5-21c-4.8-7.5-8.9-15.5-12.2-23.8C3,183.3-0.3,165.4,0,147.4C0.5,110.7,15.7,75.6,42.1,50C68.9,24,105,9.8,142.3,10.6c56.7,2.6,106.1,39.3,125.1,92.8c25.2,71.2-11.5,149.4-82.2,175.6C168.4,285.2,150.7,288,132.9,287.4z M132.9,286.3c8.8,0.3,17.6-0.3,26.3-1.7c71.6-11.6,120.3-79,108.7-150.6c-4.3-26.6-16.7-51.3-35.5-70.6c-11.9-12.2-26-21.9-41.6-28.7c-7.7-3.4-15.8-5.9-24-7.7c-8.2-1.8-16.6-2.7-25-2.9c-16.9-0.9-33.7,1.6-49.6,7.3c-32.5,11.6-59.1,35.5-74,66.5c-31.3,65.7-3.4,144.3,62.2,175.6c8.5,4,17.3,7.1,26.4,9.3C115.5,284.8,124.2,285.9,132.9,286.3L132.9,286.3z");
        const p2 = new Path2D("M6.2,281.3c0.6-0.2,1.2-0.4,1.8-0.7c0.6-0.3,1.1-0.6,1.6-0.9c1-0.6,2.1-1.3,3-2.1c2-1.4,3.8-2.9,5.6-4.5c3.4-3,6.7-6.3,9.6-9.7c5.6-6.4,10.3-13.5,14.2-21.1c1.9-3.6,3.5-7.4,5-11.1c0.7-1.9,1.4-3.8,2-5.7l1-2.9c0.3-1,0.7-2.1,1-3.1c2.6-8.5,5.3-17.6,8.3-26.8s6.3-18.5,10.3-27.7c4-9.4,8.6-18.5,14-27.2c2.8-4.5,5.8-8.8,9.1-12.9c3.3-4.2,7-8.2,10.9-11.8c4-3.7,8.5-7,13.3-9.6c4.7-2.7,10-4.3,15.4-4.8c-3.1,3.8-5.8,8-7.9,12.4c-2,4.1-3.8,8.4-5.3,12.7c-3.1,8.6-5.5,17.4-7.9,26.3c-4.8,17.8-9.3,36-15.2,54.6c-0.8,2.3-1.5,4.6-2.3,7s-1.7,4.7-2.5,7s-1.8,4.7-2.7,7.1s-2,4.8-3.1,7.2c-0.6,1.2-1.1,2.4-1.7,3.6l-0.4,0.9l-0.5,1c-0.3,0.6-0.7,1.3-1,1.9c-0.7,1.3-1.4,2.5-2.1,3.7s-1.5,2.4-2.3,3.6c-3.2,4.8-6.8,9.2-10.8,13.3c-7.9,8.2-17.4,14.6-28,18.7c-5.2,2-10.6,3.3-16.1,3.8c-2.7,0.3-5.5,0.3-8.2,0.1c-1.4-0.1-2.7-0.3-4.1-0.6c-0.7-0.1-1.3-0.3-2-0.5C7.4,281.9,6.8,281.6,6.2,281.3z");
        const p3 = new Path2D("M140.4,198.8c0.6-0.4,1.1-0.8,1.7-1.2s1.1-0.8,1.6-1.3c1-0.9,2-1.7,3-2.6c1.9-1.8,3.8-3.6,5.5-5.4c3.5-3.7,6.8-7.4,9.9-11.2c3.1-3.8,5.8-7.9,8.1-12.2c2.3-4.2,4.3-8.6,6.1-13.1c1.8-4.5,3.3-9,4.8-13.4l1.1-3.1l1-3.1l2.1-6.5c1.4-4.5,3-9.2,4.6-14s3.5-9.7,5.3-14.6c3.7-9.8,7.8-19.8,12.6-29.7c4.8-10.1,10.5-19.7,17-28.8c3.3-4.6,6.9-9,10.8-13.2c3.9-4.2,8.2-8,12.8-11.5C257.5,6.9,268,1.7,278.8,0c-3.8,3.7-7.3,7.7-10.5,11.9c-3,4-5.8,8.2-8.3,12.5c-4.8,8.5-8.8,17.5-12,26.7c-3.3,9.2-6.2,18.6-8.9,28.2s-5.3,19.4-8,29.4s-5.8,20.2-10.5,30.7c-1.2,2.6-2.5,5.3-4,7.9c-0.7,1.3-1.5,2.7-2.4,4c-0.4,0.7-0.9,1.4-1.3,2l-1.3,1.8c-3.5,4.7-7.4,9.1-11.6,13.2c-4.2,4.1-8.6,7.9-13.3,11.4c-4.6,3.5-9.3,6.7-14.3,9.7c-4.9,3-10,5.4-15.4,7.1c-2.7,0.9-5.5,1.6-8.3,2c-1.4,0.2-2.8,0.4-4.2,0.4C143.2,199.1,141.8,199,140.4,198.8z");
        const p4 = new Path2D("M94.3,208.8c0.5-0.1,1.1-0.2,1.6-0.1c0.5,0,1.1,0,1.6,0.1c1.1,0.1,2.1,0.2,3.1,0.4c2,0.3,4,0.7,6,1.2c3.8,0.9,7.5,2.1,11.1,3.6c6.7,2.7,13,6.1,18.9,10.3c2.8,2,5.5,4.2,8.1,6.4c1.3,1.1,2.6,2.3,3.8,3.5l1.9,1.8c0.6,0.6,1.3,1.3,2,2c5.3,5.4,10.9,11.2,16.7,16.9c5.9,5.7,12,11.4,18.6,16.8c6.7,5.5,13.8,10.6,21.2,15c3.8,2.3,7.8,4.3,11.9,6.1c4.2,1.9,8.5,3.4,12.9,4.6c4.5,1.2,9.1,1.9,13.7,2c4.6,0.1,9.2-0.7,13.4-2.5c-3.8-1.7-7.4-3.8-10.8-6.2c-3.2-2.3-6.2-4.8-9-7.5c-5.7-5.3-10.9-10.9-16.3-16.7c-10.6-11.6-21.1-23.4-32.8-35.1c-1.5-1.4-3-2.9-4.5-4.3s-3.1-2.9-4.6-4.3s-3.2-2.8-4.8-4.3s-3.4-2.8-5.1-4.2c-0.9-0.7-1.8-1.4-2.7-2.1l-0.7-0.5l-0.7-0.5c-0.5-0.3-1-0.7-1.5-1c-1-0.7-2-1.3-3-2s-2.1-1.2-3.1-1.8c-4.2-2.4-8.7-4.3-13.3-5.8c-9.1-3.1-18.8-4.1-28.4-3.1c-4.7,0.5-9.2,1.7-13.6,3.4c-2.2,0.9-4.2,1.9-6.2,3.1c-1,0.6-1.9,1.3-2.8,2c-0.4,0.4-0.9,0.8-1.3,1.2C95,207.8,94.6,208.3,94.3,208.8z");

        const mainLogoTextPaths = [
          "M368.8,147l-3.5-5.4c-7.6-11.9-13.8-21.3-18.5-28.1c-4.3,2.5-8.9,4.6-13.5,6.5c0,15.7,0.1,24.7,0.2,27.2h-10.2c0.1-1.4,0.2-12.8,0.2-34s-0.1-32.6-0.2-34h10.2c-0.1,1.5-0.2,13-0.2,34.4c7.9-3.3,15-8.1,21-14.2c5.5-5.5,9.2-12.5,10.5-20.1h10.8c-1.2,5.6-3.6,10.9-7,15.6c-3.9,5.3-8.6,9.9-14,13.7c4,6.2,8.2,12.4,12.5,18.6c4.3,6.2,9,12.8,14,19.9H368.8z",
          "M437.2,110.1c8.8,20.3,14.3,32.6,16.5,37.1h-12.3c-2.1-5.2-4.1-10.2-6-15.2l-1.1-2.7c-3.3-0.1-8.4-0.1-15.1-0.1s-11.8,0-15.1,0.1c-2.7,6.8-5,12.8-6.9,17.9H388l4.1-9.5c1.4-3.4,4.6-11.1,9.6-22.9s9.3-22.3,13-31.3c-0.8-0.2-1.4-0.7-1.8-1.5c-0.4-0.8-0.6-1.8-0.5-2.7h9.4c1.2,0,1.9,0.3,2.2,1.1L437.2,110.1z M431.9,122.5l-5.5-13.4c-0.3-0.8-1.4-3.4-3.3-7.8s-3.2-8-4.1-10.7c-1.9,5.4-4.9,13.1-8.9,23c-2.4,5.8-3.6,8.7-3.7,8.9L431.9,122.5z",
          "M502.7,147.1c-0.5-1.2-2.8-5.1-6.8-11.7c-4-6.6-6.8-11.1-8.3-13.3c-0.8,0.1-1.9,0.1-3.4,0.1h-13.5c0,13.7,0.1,22,0.2,24.9h-10.2c0.1-3.5,0.2-13.5,0.2-30.1c0-22.5-0.1-35.1-0.2-37.8h22.1c5.3-0.1,10.5,0.8,15.4,2.8c3.9,1.6,7.3,4.3,9.7,7.7c2.2,3.4,3.4,7.4,3.3,11.4c0.1,4.2-1.2,8.4-3.7,11.8c-2.7,3.5-6.4,6-10.6,7.3c2.5,4,5.7,9.2,9.6,15.6c4,6.4,6.4,10.2,7.3,11.3H502.7z M483.3,115.8c5.6,0,10-1.2,13-3.6c3-2.4,4.6-5.9,4.6-10.5c0-5.1-1.6-9-4.8-11.6s-7.8-4-13.8-4h-7.2c-1.1-0.1-2.2,0.1-3.3,0.4c-0.6,0.3-1.1,0.9-1.1,1.5v26.9c2.5,0.6,5.1,0.9,7.7,0.9L483.3,115.8z",
          "M535,143.5c-5.2-3-9.6-7.3-12.6-12.5c-3.1-5.4-4.7-11.6-4.6-17.9c-0.1-6.3,1.4-12.6,4.5-18.2c2.9-5.2,7.2-9.5,12.4-12.4c5.4-3,11.4-4.5,17.6-4.4c6.1-0.1,12.1,1.5,17.4,4.5c5.2,3,9.5,7.3,12.5,12.5c6.1,11.2,6.2,24.6,0.2,35.9c-2.9,5.2-7.1,9.6-12.3,12.5c-5.3,3.1-11.4,4.6-17.6,4.6C546.4,148.2,540.3,146.6,535,143.5z M564.9,138.5c3.5-2.1,6.3-5.2,8.1-8.9c2-4.1,3-8.5,2.9-13.1c0.1-5.7-1-11.3-3.1-16.5c-1.8-4.5-4.8-8.4-8.6-11.3c-3.6-2.7-8.1-4.1-12.6-4.1c-4.2-0.1-8.3,1-11.9,3.1c-3.5,2.1-6.3,5.1-8.2,8.7c-2,3.9-3,8.2-2.9,12.5c-0.1,5.8,1,11.5,3.1,16.8c1.8,4.6,4.8,8.6,8.7,11.6c3.6,2.8,8.1,4.3,12.6,4.2C557.2,141.8,561.3,140.7,564.9,138.5L564.9,138.5z",
          "M594.8,147.1c0.1-1.4,0.2-12.8,0.2-34c0-21.2-0.1-32.6-0.2-34H605c-0.1,1.2-0.2,11.3-0.2,30.1c0,16,0,26.2,0.1,30.5c2.3,0.5,4.7,0.8,7.1,0.8c14.4,0,22.9-0.1,25.5-0.4v7L594.8,147.1z",
          "M373.9,171.8c-6.8-0.2-13.6-0.3-20.3-0.3l-0.1,26.3c0,12.5,0.1,24.1,0.2,35h-10.2c0.1-5.1,0.2-16,0.2-32.6c0-13.7,0-23.2-0.1-28.7c-6.8,0-13.6,0.1-20.3,0.3V165h50.7V171.8z",
          "M412.8,195.7c8.8,20.2,14.3,32.6,16.5,37H417c-2.1-5.2-4.1-10.2-6-15.2l-1.1-2.7c-3.3-0.1-8.4-0.1-15.1-0.1c-6.7,0-11.8,0-15.1,0.1c-2.7,6.8-5,12.8-6.9,17.9h-9.1l4.1-9.5c1.4-3.4,4.6-11,9.6-22.9c5-11.8,9.3-22.3,12.9-31.3c-0.8-0.2-1.4-0.7-1.8-1.4c-0.4-0.8-0.6-1.8-0.5-2.7h9.4c1.2,0,1.9,0.4,2.2,1.1L412.8,195.7z M407.6,208.1l-5.5-13.4c-0.3-0.8-1.4-3.4-3.3-7.8c-1.8-4.4-3.2-7.9-4.1-10.7c-1.9,5.4-4.8,13.1-8.9,23c-2.4,5.8-3.6,8.7-3.7,8.9L407.6,208.1z",
          "M437.6,232.8c0.1-1.4,0.2-12.7,0.2-33.9c0-21.2-0.1-32.5-0.2-33.9h10.2c-0.1,1.2-0.2,11.2-0.2,30c0,15.9,0,26.1,0.1,30.4c2.3,0.5,4.7,0.8,7.1,0.8c14.4,0,22.9-0.1,25.5-0.4v7L437.6,232.8z",
          "M537,195.9c8.8,20.2,14.3,32.5,16.5,37h-12.3c-2.1-5.2-4.1-10.2-6-15.2l-1.1-2.7c-3.3-0.1-8.4-0.1-15.1-0.1c-6.7,0-11.8,0-15.1,0.1c-2.7,6.8-5,12.8-6.9,17.9h-9.1l4.1-9.5c1.4-3.4,4.6-11,9.6-22.9s9.3-22.3,12.9-31.3c-0.8-0.2-1.4-0.7-1.7-1.5c-0.5-0.8-0.6-1.8-0.5-2.7h9.4c0.9-0.1,1.8,0.3,2.2,1.1L537,195.9z M531.8,208.3l-5.5-13.4c-0.3-0.8-1.4-3.4-3.2-7.8c-1.8-4.4-3.2-7.9-4.1-10.7c-1.9,5.4-4.8,13.1-8.9,23c-2.4,5.8-3.6,8.7-3.7,8.9L531.8,208.3z",
          "M555.9,165l6.1,15.6l15.6,39.9c3.6-9.4,7.6-20,12.2-31.8c5.1-13.1,8.2-21,9.2-23.7h9.2c-1.9,3.7-5.5,12-10.8,24.9c-5.4,12.9-11,27.2-17,43H573c-4.6-11-10.2-24.4-17-40s-10.9-25-12.4-28L555.9,165z",
          "M648.5,226c5.6-0.1,9.4-0.2,11.3-0.3v7.2h-45.1c0.1-1.4,0.2-12.7,0.2-33.9c0-21.2-0.1-32.5-0.2-33.9h43.6v7.1c-6.6-0.2-16.9-0.4-30.9-0.4c-1.5,0-2.4,0.4-2.6,1.3c-0.1,3.7-0.1,10.9-0.1,21.6h4.7c4.8,0,12.2-0.1,22.2-0.4v7.4c-5.9-0.2-14.9-0.3-26.9-0.3c0,12.1,0,20.2,0.1,24.2c2.6,0.6,5.3,0.8,8,0.7C637.6,226.2,642.8,226.1,648.5,226z",
          "M709.7,232.9c-0.5-1.2-2.8-5.1-6.8-11.7s-6.7-11.1-8.2-13.3c-0.8,0.1-1.9,0.1-3.4,0.1h-13.5c0,13.6,0.1,21.9,0.2,24.9h-10.2c0.1-3.5,0.2-13.5,0.2-30c0-22.5-0.1-35.1-0.2-37.8h22.1c5.3-0.1,10.5,0.8,15.4,2.8c3.9,1.6,7.3,4.2,9.7,7.7c2.2,3.4,3.4,7.4,3.3,11.4c0.1,4.2-1.2,8.4-3.7,11.8c-2.7,3.4-6.4,6-10.6,7.2c2.5,4,5.7,9.2,9.6,15.6c4,6.4,6.4,10.1,7.3,11.3H709.7z M690.4,201.6c5.6,0,10-1.2,13-3.5c3-2.4,4.6-5.9,4.6-10.5c0-5.1-1.6-9-4.8-11.6c-3.2-2.7-7.8-4-13.8-4h-7.2c-1.1-0.1-2.2,0.1-3.3,0.4c-0.6,0.3-1.1,0.9-1.2,1.6v26.9c2.5,0.6,5.1,0.9,7.7,0.9L690.4,201.6z",
          "M777.3,195.9c8.8,20.2,14.3,32.5,16.5,37h-12.3c-2.1-5.2-4.1-10.2-6-15.2l-1.1-2.7c-3.3-0.1-8.4-0.1-15.1-0.1c-6.7,0-11.8,0-15.1,0.1c-2.7,6.8-5,12.8-6.9,17.9h-9.1l4.1-9.5c1.4-3.4,4.6-11,9.6-22.9c5-11.8,9.3-22.3,12.9-31.3c-0.8-0.2-1.4-0.7-1.7-1.5c-0.5-0.8-0.6-1.8-0.5-2.7h9.4c0.9-0.1,1.8,0.3,2.2,1.1L777.3,195.9z M772.1,208.3l-5.5-13.4c-0.3-0.8-1.4-3.4-3.2-7.8c-1.8-4.4-3.2-7.9-4.1-10.7c-1.9,5.4-4.8,13.1-8.9,23c-2.4,5.8-3.6,8.7-3.7,8.9L772.1,208.3z",
          "M342.3,258c0,7-4.4,12.4-12.9,12.4h-5.9c-0.3,0-0.5-0.2-0.5-0.5c0,0,0,0,0-0.1v-23.6c0-0.3,0.2-0.5,0.5-0.5c0,0,0,0,0.1,0h5.9C337.9,245.7,342.3,251.1,342.3,258z M338.9,258c0-5.8-3.2-9.3-9.6-9.3h-3.1v18.7h3.1C335.8,267.4,338.9,263.9,338.9,258z",
          "M370.1,267.9v1.9c0,0.3-0.2,0.5-0.5,0.5c0,0,0,0-0.1,0h-15.1c-0.3,0-0.5-0.2-0.5-0.5c0,0,0,0,0-0.1v-23.6c0-0.3,0.2-0.5,0.5-0.5c0,0,0,0,0.1,0h15c0.3,0,0.5,0.2,0.5,0.5c0,0,0,0,0,0.1v1.9c0,0.3-0.2,0.5-0.5,0.5c0,0,0,0,0,0h-12.3v7.3h11.3c0.3,0,0.5,0.2,0.5,0.5c0,0,0,0,0,0.1v1.9c0,0.3-0.2,0.5-0.5,0.5c0,0,0,0-0.1,0h-11.3v8.4h12.3C369.9,267.4,370.1,267.6,370.1,267.9C370.1,267.9,370.1,267.9,370.1,267.9z",
          "M400.2,269.8c0.2,0.4,0,0.6-0.4,0.6h-2.3c-0.3,0-0.5-0.1-0.6-0.4l-4.5-8.8h-6.5v8.7c0,0.3-0.2,0.5-0.5,0.5c0,0,0,0-0.1,0h-2.2c-0.3,0-0.5-0.2-0.5-0.5c0,0,0,0,0-0.1v-23.6c0-0.3,0.2-0.5,0.5-0.5c0,0,0,0,0.1,0h8.8c6.5,0,8.9,2.8,8.9,7.7c0,3.9-1.5,6.5-5.2,7.4L400.2,269.8z M385.9,258.2h6.2c3.3,0,5.5-0.9,5.5-4.8s-2.2-4.7-5.5-4.7h-6.2V258.2z",
          "M437.6,246.2v23.6c0,0.3-0.2,0.5-0.5,0.5c0,0,0,0-0.1,0h-2.2c-0.3,0-0.5-0.2-0.5-0.5c0,0,0,0,0-0.1V252l-7.6,18c-0.1,0.3-0.3,0.4-0.6,0.4H424c-0.3,0-0.5-0.1-0.6-0.4l-7.5-17.9v17.8c0,0.3-0.2,0.5-0.5,0.5c0,0,0,0-0.1,0h-2.2c-0.3,0-0.5-0.2-0.5-0.5c0,0,0,0,0-0.1v-23.6c0-0.3,0.2-0.5,0.5-0.5c0,0,0,0,0.1,0h2.8c0.3,0,0.5,0.1,0.6,0.4l8.5,20.6l8.5-20.6c0.1-0.2,0.4-0.4,0.6-0.4h2.9C437.4,245.7,437.6,245.9,437.6,246.2C437.6,246.2,437.6,246.2,437.6,246.2z",
          "M470,270.4h-2.3c-0.3,0-0.5-0.2-0.6-0.4l-1.8-4.8h-11.3l-1.7,4.8c-0.1,0.3-0.3,0.4-0.6,0.4h-2.3c-0.4,0-0.6-0.2-0.4-0.6l9-23.7c0.1-0.3,0.4-0.4,0.6-0.4h2.2c0.3,0,0.5,0.2,0.6,0.4l9,23.7C470.6,270.2,470.4,270.4,470,270.4z M464.3,262.3l-4.6-12.5l-4.6,12.5H464.3z",
          "M497,246.2v1.9c0,0.3-0.2,0.5-0.5,0.5c0,0,0,0,0,0h-7.4v21.2c0,0.3-0.2,0.5-0.5,0.5c0,0,0,0-0.1,0h-2.2c-0.3,0-0.5-0.2-0.5-0.5c0,0,0,0,0-0.1v-21.2h-7.4c-0.3,0-0.5-0.2-0.5-0.5c0,0,0,0,0-0.1v-1.9c0-0.3,0.2-0.5,0.5-0.5c0,0,0,0,0.1,0h18.1C496.7,245.7,497,245.9,497,246.2C497,246.2,497,246.2,497,246.2z",
          "M506.8,258.2c0-7,5.7-12.6,12.7-12.6c7,0,12.6,5.7,12.6,12.7c0,7-5.7,12.6-12.6,12.6C512.5,270.9,506.8,265.2,506.8,258.2C506.8,258.2,506.8,258.2,506.8,258.2z M528.8,258.2c-0.1-5.2-4.4-9.3-9.6-9.2c-5.2,0.1-9.3,4.4-9.2,9.6c0.1,5.1,4.3,9.2,9.4,9.2c5.2,0,9.4-4.2,9.4-9.4C528.9,258.3,528.9,258.2,528.8,258.2L528.8,258.2z M523.1,238.9l-2.1,4.4c-0.1,0.3-0.3,0.4-0.6,0.4h-1.7c-0.4,0-0.6-0.2-0.4-0.6l2.1-4.4c0.1-0.3,0.3-0.4,0.6-0.4h1.7C523.1,238.3,523.3,238.5,523.1,238.9z",
          "M560.4,267.9v1.9c0,0.3-0.2,0.5-0.5,0.5c0,0,0,0-0.1,0H545c-0.3,0-0.5-0.2-0.5-0.5c0,0,0,0,0-0.1v-23.6c0-0.3,0.2-0.5,0.5-0.5c0,0,0,0,0.1,0h2.2c0.3,0,0.5,0.2,0.5,0.5c0,0,0,0,0,0.1v21.2h12.1C560.2,267.4,560.4,267.6,560.4,267.9C560.4,267.9,560.4,267.9,560.4,267.9z",
          "M570.6,258.2c0-7,5.7-12.6,12.7-12.6c7,0,12.6,5.7,12.6,12.7c0,7-5.7,12.6-12.6,12.6C576.3,270.9,570.6,265.2,570.6,258.2C570.6,258.2,570.6,258.2,570.6,258.2z M592.6,258.2c-0.1-5.2-4.4-9.3-9.6-9.2c-5.2,0.1-9.3,4.4-9.2,9.6c0.1,5.1,4.3,9.2,9.4,9.2c5.2,0,9.4-4.2,9.4-9.4C592.7,258.3,592.7,258.2,592.6,258.2L592.6,258.2z",
          "M631.4,257.9v1.4c0,6.5-4.3,11.5-11.3,11.5c-7,0-12.7-5.7-12.7-12.7c0-7,5.7-12.7,12.7-12.7l0,0c3.1,0,6.1,1.2,8.4,3.4c0.2,0.2,0.2,0.5,0.1,0.7c0,0-0.1,0.1-0.1,0.1L627,251c-0.2,0.2-0.5,0.2-0.7,0.1c0,0,0,0-0.1-0.1c-1.7-1.6-4-2.4-6.3-2.4c-5.2,0-9.5,4.3-9.5,9.5c0,5.2,4.3,9.5,9.5,9.5c4.7,0,8-3,8.1-7.3h-7.7c-0.3,0-0.5-0.2-0.5-0.5c0,0,0,0,0-0.1v-1.9c0-0.3,0.2-0.5,0.5-0.5c0,0,0,0,0,0h10.4C631.1,257.3,631.3,257.6,631.4,257.9C631.4,257.9,631.4,257.9,631.4,257.9z",
          "M661.8,270.4h-2.3c-0.3,0-0.5-0.2-0.6-0.4l-1.7-4.8h-11.3l-1.7,4.8c-0.1,0.3-0.3,0.4-0.6,0.4h-2.3c-0.4,0-0.6-0.2-0.4-0.6l9-23.7c0.1-0.3,0.4-0.4,0.6-0.4h2.2c0.3,0,0.5,0.2,0.6,0.4l9,23.7C662.4,270.2,662.2,270.4,661.8,270.4z M656.1,262.3l-4.6-12.5l-4.5,12.5H656.1z",
          "M341.1,56.3c0,6.6-4.1,11.7-12.2,11.7h-5.6c-0.3,0-0.5-0.2-0.5-0.4c0,0,0,0,0-0.1V45.1c0-0.3,0.2-0.5,0.4-0.5c0,0,0,0,0.1,0h5.6C336.9,44.6,341.1,49.7,341.1,56.3z M337.9,56.3c0-5.5-3-8.8-9-8.8h-3v17.7h3C334.9,65.1,337.9,61.8,337.9,56.3L337.9,56.3z",
          "M362.2,67.3c0.2,0.3,0,0.6-0.4,0.6h-2.2c-0.3,0-0.5-0.1-0.6-0.4l-4.3-8.3h-6.1v8.2c0,0.3-0.2,0.5-0.4,0.5c0,0,0,0-0.1,0H346c-0.3,0-0.5-0.2-0.5-0.4c0,0,0,0,0-0.1V45.1c0-0.3,0.2-0.5,0.4-0.5c0,0,0,0,0.1,0h8.3c6.1,0,8.4,2.6,8.4,7.3c0,3.7-1.4,6.1-4.9,7L362.2,67.3z M348.6,56.4h5.9c3.1,0,5.2-0.8,5.2-4.5s-2.1-4.5-5.2-4.5h-5.9V56.4z",
          "M385.5,67.9h-2.1c-0.3,0-0.5-0.1-0.6-0.4l-1.6-4.5h-10.7l-1.6,4.5c-0.1,0.3-0.3,0.4-0.6,0.4H366c-0.4,0-0.5-0.2-0.4-0.6l8.5-22.4c0.1-0.2,0.3-0.4,0.6-0.4h2.1c0.3,0,0.5,0.2,0.6,0.4l8.5,22.4C386,67.7,385.8,67.9,385.5,67.9z M380.1,60.3l-4.3-11.8l-4.3,11.8H380.1z",
          "M389.4,66c0-1.3,1.1-2.4,2.4-2.4c1.3,0,2.4,1.1,2.4,2.4s-1.1,2.4-2.4,2.4c0,0,0,0,0,0C390.5,68.4,389.4,67.3,389.4,66z"
        ];

        ctx.save();
        const logoTargetW = 340;
        const logoScale = logoTargetW / 793.8;
        ctx.translate(centerX - logoTargetW / 2, 372);
        ctx.scale(logoScale, logoScale);

        ctx.fillStyle = '#434547';
        ctx.fill(p1);
        ctx.fillStyle = '#BF815D';
        ctx.fill(p2);
        ctx.fillStyle = '#DC968A';
        ctx.fill(p3);
        ctx.fillStyle = '#C89581';
        ctx.fill(p4);

        ctx.fillStyle = '#434547';
        mainLogoTextPaths.forEach(pathStr => {
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
        a.download = `Cita_Dra_KarolTalavera_${selectedService?.name.trim().replace(/\s+/g, '_') || 'Servicio'}_${user?.name.trim().replace(/\s+/g, '_') || 'Paciente'}.jpg`;
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
          <h2 className="text-2xl font-semibold text-stone-800 mb-6">¡Cita Confirmada!</h2>
          
          <div className="text-stone-600 mb-6 p-5 rounded-2xl" style={{ backgroundColor: '#faf2f2' }}>
            <p className="font-semibold text-stone-800 mb-3 text-center text-sm">Detalles de su reserva:</p>
            
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
              <Share2 size={16} />
              {isSharingImage ? 'Generando imagen...' : (navigator.share ? 'Compartir confirmación de cita' : 'Descargar Imagen / Screenshot')}
            </button>

            <button 
              onClick={handleDownloadJpg}
              disabled={isSharingImage}
              className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 text-sm"
            >
              <Download size={16} />
              {isSharingImage ? 'Generando JPG...' : 'Descargar confirmación en JPG'}
            </button>

            <div className="pt-4 pb-1 flex flex-col items-center">
              <img src="/logo.svg" alt="Dra. Karol Talavera Dermatóloga" className="h-20 sm:h-24 w-auto object-contain" />
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
            <h1 className="text-lg sm:text-2xl font-semibold text-stone-800">Reserve su cita</h1>
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
                  1. Seleccione una fecha
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
                    2. Seleccione un horario disponible
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

                        // If duration is 2, only show slots with a 2-hour range within TIME_SLOTS
                        if (duration === 2 && idx + 2 >= TIME_SLOTS.length) {
                          return null;
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
