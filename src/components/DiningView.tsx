import React, { useMemo, useState } from 'react';
import { UtensilsCrossed, MapPin, Clock, Check, Info, AlertTriangle } from 'lucide-react';
import { MealService, UserProfile } from '../types';
import { DIETARY_META, dietaryLabel } from '../lib/dietary';

interface DiningViewProps {
  mealServices: MealService[];
  currentUser: UserProfile;
  onSelectMeal: (serviceId: string, optionId: string | null) => void;
}

const TYPE_META: Record<MealService['type'], { label: string; className: string }> = {
  breakfast: { label: 'Breakfast', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  lunch:     { label: 'Lunch',     className: 'bg-blue-50 text-blue-700 border-blue-200' },
  snack:     { label: 'Refreshments', className: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  reception: { label: 'Reception', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

export const DiningView: React.FC<DiningViewProps> = ({ mealServices, currentUser, onSelectMeal }) => {
  const [activeDay, setActiveDay] = useState<number>(1);

  const days = useMemo(() => {
    const seen: number[] = [];
    for (const m of mealServices) if (!seen.includes(m.day)) seen.push(m.day);
    return seen.sort((a, b) => a - b);
  }, [mealServices]);

  const visible = useMemo(
    () => mealServices.filter((m) => m.day === activeDay).sort((a, b) => a.startMinutes - b.startMinutes),
    [mealServices, activeDay],
  );

  const chosenCount = mealServices.filter((m) => m.selections[currentUser.id]).length;

  /** Servings already claimed for an option, excluding nothing — the current
   *  user's own pick is included, which is what the kitchen counts. */
  const servingsTaken = (service: MealService, optionId: string) =>
    Object.values(service.selections).filter((id) => id === optionId).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <UtensilsCrossed className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-slate-900">Dining & Refreshments</h2>
            </div>
            <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
              Choose your meals ahead of time so catering can plan accurate numbers.
              Your selection appears on your digital badge for service staff.
            </p>
          </div>
          <div className="shrink-0 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
            <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">Your selections</div>
            <div className="text-2xl font-bold text-blue-700 leading-tight">
              {chosenCount}
              <span className="text-sm font-medium text-blue-600/70"> / {mealServices.length}</span>
            </div>
          </div>
        </div>

        {currentUser.dietaryTag && (
          <div className="mt-4 flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">
              Your profile records a standing dietary requirement of{' '}
              <span className="font-semibold text-slate-800">{dietaryLabel(currentUser.dietaryTag)}</span>.
              Matching options are marked below.
            </p>
          </div>
        )}
      </div>

      {/* Day switcher */}
      <div className="flex items-center gap-2">
        {days.map((d) => {
          const label = mealServices.find((m) => m.day === d)?.dateStr ?? `Day ${d}`;
          const isActive = d === activeDay;
          return (
            <button
              key={d}
              onClick={() => setActiveDay(d)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-600 hover:text-blue-700'
              }`}
            >
              Day {d}: {label.replace(', 2026', '')}
            </button>
          );
        })}
      </div>

      {/* Services */}
      <div className="space-y-4">
        {visible.map((service) => {
          const mySelection = service.selections[currentUser.id];
          const typeMeta = TYPE_META[service.type];

          return (
            <div key={service.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${typeMeta.className}`}>
                      {typeMeta.label}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">{service.name}</h3>
                  </div>
                  <div className="flex items-center gap-3.5 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {service.startTime} – {service.endTime}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {service.location}
                    </span>
                  </div>
                </div>
                {mySelection ? (
                  <button
                    onClick={() => onSelectMeal(service.id, null)}
                    className="shrink-0 text-xs font-semibold text-slate-400 hover:text-amber-700 transition-colors cursor-pointer"
                  >
                    Clear selection
                  </button>
                ) : (
                  <span className="shrink-0 text-xs font-medium text-amber-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Not yet selected
                  </span>
                )}
              </div>

              <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {service.options.map((option) => {
                  const isSelected = mySelection === option.id;
                  const taken = servingsTaken(service, option.id);
                  const isFull = option.maxServings !== undefined && taken >= option.maxServings && !isSelected;
                  const matchesProfile = currentUser.dietaryTag === option.dietary;
                  const meta = DIETARY_META[option.dietary];

                  return (
                    <button
                      key={option.id}
                      disabled={isFull}
                      onClick={() => onSelectMeal(service.id, isSelected ? null : option.id)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 shadow-sm'
                          : isFull
                            ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                            : 'border-slate-200 bg-white hover:border-blue-400 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${meta.className}`}>
                          {meta.label}
                        </span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-bold text-slate-900 mb-1">{option.label}</div>
                      <p className="text-xs text-slate-500 leading-relaxed mb-2.5">{option.description}</p>

                      <div className="flex items-center justify-between gap-2">
                        {option.maxServings !== undefined ? (
                          <span className={`text-[11px] font-semibold ${isFull ? 'text-amber-700' : 'text-slate-400'}`}>
                            {isFull ? 'Fully booked' : `${option.maxServings - taken} of ${option.maxServings} left`}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Unlimited</span>
                        )}
                        {matchesProfile && (
                          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded">
                            Matches your profile
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
