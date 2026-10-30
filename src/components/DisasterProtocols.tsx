import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertOctagon,
  HeartPulse,
  Compass,
  ShieldAlert,
  Copy,
  Check,
} from 'lucide-react';
import type { BloodType, MedicalStatus, MeshSnapshot } from '../types/mesh';

export type DisasterType = 'earthquake' | 'flood' | 'landslide';

interface ScenarioProtocol {
  id: string;
  label: string;
  severity: MedicalStatus;
  summary: string;
  recommendedSosCategory: string;
  recommendedSosMessage: string;
  whatToDo: Array<{
    step: string;
    detail: string;
  }>;
  whatNotToDo: Array<{
    prohibition: string;
    reason: string;
  }>;
  medicalGuidance: string;
}

interface DisasterDefinition {
  id: DisasterType;
  title: string;
  subtitle: string;
  telemetryTag: string;
  scenarios: ScenarioProtocol[];
}

const DISASTER_PROTOCOLS: Record<DisasterType, DisasterDefinition> = {
  earthquake: {
    id: 'earthquake',
    title: 'Earthquake Response & Structural Collapse Protocol',
    subtitle:
      'Seismic shockwave survival, trapped-under-debris triage, and aftershock structural safety.',
    telemetryTag: 'Seismic / Structural Collapse · Primary Hazard: Falling Debris & Crush Syndrome',
    scenarios: [
      {
        id: 'eq-trapped',
        label: 'Trapped Under Debris',
        severity: 'CRITICAL',
        summary:
          'Confined space survival when immobilized beneath structural rubble or collapsed masonry.',
        recommendedSosCategory: 'Medical / Structural Collapse',
        recommendedSosMessage: 'Trapped under debris, need medical assistance.',
        whatToDo: [
          {
            step: '01. Protect Airway & Conserve Oxygen',
            detail:
              'Cover your mouth and nose with cloth or clothing to avoid inhaling pulverized concrete and silica dust.',
          },
          {
            step: '02. Signal via Rhythmic Pipe or Wall Tapping',
            detail:
              'Tap on structural metal pipes, conduits, or concrete walls in sets of 3 strikes so acoustic search teams can triangulate your void.',
          },
          {
            step: '03. Activate AetherMesh Offline SOS Beacon',
            detail:
              'Keep your transceiver in CRITICAL medical mode so UDP beacons continuously hop across surface relays with your blood type and last known GPS.',
          },
          {
            step: '04. Control Bleeding & Monitor Crush Pressure',
            detail:
              'Apply direct firm pressure to any active lacerations using clean fabric and avoid shifting load-bearing beams above you.',
          },
        ],
        whatNotToDo: [
          {
            prohibition: 'Do NOT ignite lighters, matches, or open flames',
            reason:
              'Ruptured natural gas lines and trapped methane pockets inside collapsed structures create an immediate explosion hazard.',
          },
          {
            prohibition: 'Do NOT shout continuously unless rescuers are audible nearby',
            reason:
              'Shouting rapidly exhausts oxygen reserves, causes severe dust inhalation, and depletes hydration.',
          },
          {
            prohibition: 'Do NOT kick or dislodge wedged masonry or timber supports',
            reason:
              'Disturbing friction-locked debris can trigger secondary void collapse before shoring teams arrive.',
          },
          {
            prohibition: 'Do NOT abruptly release a limb pinned for over 2 hours without hydration/triage',
            reason:
              'Sudden decompression of crushed muscle tissue can release potassium and toxins into the bloodstream (Crush Syndrome).',
          },
        ],
        medicalGuidance:
          'Broadcast Blood Type (e.g., O+) and CRITICAL status immediately. Acoustic tapping + UDP beacon every 2.5s maximizes extraction speed.',
      },
      {
        id: 'eq-indoors',
        label: 'Indoors During Active Shaking',
        severity: 'URGENT',
        summary:
          'Immediate protective posture inside multi-story buildings during primary P-wave and S-wave ground motion.',
        recommendedSosCategory: 'Structural Collapse / Trapped',
        recommendedSosMessage:
          'Experiencing severe seismic shaking indoors. Structural damage reported on floor.',
        whatToDo: [
          {
            step: '01. Drop, Cover, and Hold On Immediately',
            detail:
              'Drop to hands and knees, crawl underneath a sturdy desk or load-bearing interior table, and grip the leg firmly.',
          },
          {
            step: '02. Shield Head, Neck, and Spine',
            detail:
              'If no heavy furniture is nearby, crouch against an interior load-bearing wall away from glass windows and shield your neck with both arms.',
          },
          {
            step: '03. Shut Off Gas & Main Breakers After Shaking Stops',
            detail:
              'Once tremors subside, close the main gas valve if you smell gas or hear hissing, and disconnect main electrical breakers.',
          },
          {
            step: '04. Evacuate via Reinforced Stairwells Only',
            detail:
              'Check stairwells for structural cracks before descending to an open assembly zone away from facades.',
          },
        ],
        whatNotToDo: [
          {
            prohibition: 'Do NOT use elevators under any circumstances',
            reason:
              'Power grid failure and deformed guide rails will trap occupants between floors with no ventilation.',
          },
          {
            prohibition: 'Do NOT run outside while the building is still shaking',
            reason:
              'Shattering curtain-wall glass, falling masonry cornices, and facade collapses make building exits the most lethal zone during active motion.',
          },
          {
            prohibition: 'Do NOT stand in narrow doorways in modern masonry buildings',
            reason:
              'Modern doorways are no stronger than surrounding walls and do not shield you from flying debris.',
          },
          {
            prohibition: 'Do NOT re-enter a damaged structure before aftershocks subside',
            reason:
              'Aftershocks frequently topple weakened columns that survived the initial tremor.',
          },
        ],
        medicalGuidance:
          'Check all occupants for head trauma and glass lacerations before moving. Log last known GPS while near windows if possible.',
      },
      {
        id: 'eq-outdoors',
        label: 'Outdoors / Near Infrastructure',
        severity: 'STABLE',
        summary:
          'Navigating open streets, utility corridors, bridges, and coastal zones during and after seismic activity.',
        recommendedSosCategory: 'Grid Blackout / Shelter Needed',
        recommendedSosMessage:
          'Outdoors in seismic zone. Downed power lines and road fissures blocking route.',
        whatToDo: [
          {
            step: '01. Move to a Clear Open Area Immediately',
            detail:
              'Step away from tall buildings, utility poles, transformers, overpasses, and masonry perimeter walls.',
          },
          {
            step: '02. Pull Over Safely if Driving',
            detail:
              'Stop in a clear lane away from bridges, overpasses, and overhead gantries; set the parking brake and remain inside until shaking stops.',
          },
          {
            step: '03. Move to High Ground if Near Coastline',
            detail:
              'If shaking lasts more than 20 seconds near the coast, move inland or climb above 30 meters elevation immediately for tsunami protection.',
          },
          {
            step: '04. Switch Device to Mesh Relay Mode if Uninjured',
            detail:
              'If you are safe in an open area, switch your AetherMesh node to Relay or Rescuer mode to bridge SOS packets from trapped victims.',
          },
        ],
        whatNotToDo: [
          {
            prohibition: 'Do NOT approach downed power lines or flooded utility vaults',
            reason:
              'Downed high-voltage lines can energize wet pavement and metal fences tens of meters away.',
          },
          {
            prohibition: 'Do NOT drive across cracked bridges or buckled asphalt',
            reason:
              'Subsurface soil liquefaction and sheared bridge piers can collapse under vehicle weight.',
          },
          {
            prohibition: 'Do NOT congregate at the base of steep cliffs or Retaining Walls',
            reason:
              'Seismic tremors destabilize rockfaces and trigger immediate post-quake rockfalls.',
          },
        ],
        medicalGuidance:
          'Keep transceiver active to forward multi-hop SOS frames from collapsed buildings to field rescue teams.',
      },
    ],
  },
  flood: {
    id: 'flood',
    title: 'Flood & Flash Inundation Survival Protocol',
    subtitle:
      'Rapid water rise response, rooftop extraction signaling, electrical hazard avoidance, and waterborne medical safety.',
    telemetryTag: 'Hydrological Inundation · Primary Hazard: Swiftwater Currents & Electrocution',
    scenarios: [
      {
        id: 'fl-trapped-building',
        label: 'Rising Water Inside Building / Rooftop',
        severity: 'CRITICAL',
        summary:
          'Emergency vertical evacuation when floodwaters breach ground floors and cut off street-level egress.',
        recommendedSosCategory: 'Medical / Flood Extraction',
        recommendedSosMessage:
          'Marooned by rising floodwater on upper floor. Need urgent boat or helicopter medical extraction.',
        whatToDo: [
          {
            step: '01. Disconnect Main Electrical Breaker Immediately',
            detail:
              'Shut off the main circuit breaker and gas supply from a dry position before water reaches wall outlets.',
          },
          {
            step: '02. Move to the Highest Unenclosed Floor or Open Roof',
            detail:
              'Ascend to the highest open roof deck or upper level with direct exterior access for boat or rotorcraft extraction.',
          },
          {
            step: '03. Broadcast GPS & Medical Triage Status on AetherMesh',
            detail:
              'Lock your GNSS coordinates and broadcast SOS so rescue watercraft can home in on your azimuth bearing even in heavy rain.',
          },
          {
            step: '04. Insulate Vulnerable Patients Against Hypothermia',
            detail:
              'Keep injured, elderly, or pediatric survivors dry and wrapped in thermal layers while awaiting boat extraction.',
          },
        ],
        whatNotToDo: [
          {
            prohibition: 'Do NOT climb into a closed attic without a roof hatch or axe',
            reason:
              'Rising water can trap occupants against the underside of a sealed roof with no escape route.',
          },
          {
            prohibition: 'Do NOT touch electrical switches, panels, or appliances while standing in water',
            reason:
              'Submerged wiring conducts lethal current throughout the flooded room.',
          },
          {
            prohibition: 'Do NOT drink untreated floodwater or use it to wash open wounds',
            reason:
              'Floodwaters carry raw sewage, industrial chemicals, and pathogens that cause severe sepsis and gastrointestinal collapse.',
          },
          {
            prohibition: 'Do NOT tie yourself to fixed fixtures near turbulent water intakes',
            reason:
              'Rapidly rising water or debris surges can submerge fixed anchor points.',
          },
        ],
        medicalGuidance:
          'Clean any lacerations strictly with sealed bottled or boiled water. Include hypothermia or insulin/medication needs in your SOS message.',
      },
      {
        id: 'fl-swiftwater',
        label: 'Flash Flood / Submerged Roadways',
        severity: 'URGENT',
        summary:
          'Evacuating low-lying drainage basins, underpasses, and flooded road networks during sudden flash flooding.',
        recommendedSosCategory: 'Medical / Flood Extraction',
        recommendedSosMessage:
          'Stranded near submerged roadway due to flash flood current. Requesting immediate rescue.',
        whatToDo: [
          {
            step: '01. Climb Immediately to Higher Ground (15+ Meters)',
            detail:
              'Abandon low-lying riverbeds, drainage channels, and canyons at the first sign of turbid, rising water.',
          },
          {
            step: '02. Exit Stalled Vehicles in Rising Water Immediately',
            detail:
              'If water rises around a stalled vehicle, unbuckle seatbelts, open side windows before electrical shorting occurs, and move to high ground.',
          },
          {
            step: '03. Probe Ground Ahead with a Rigid Pole if Forced to Wade',
            detail:
              'If you must cross still shallow water to reach safety, probe ahead with a stick to detect open manholes and washed-out pavement.',
          },
          {
            step: '04. Seal Transceiver in Waterproof Pouch Above Chest Height',
            detail:
              'Keep your phone or ESP32 node elevated above water level to preserve 2.4 GHz RF propagation.',
          },
        ],
        whatNotToDo: [
          {
            prohibition: 'Do NOT walk through moving water deeper than 15 cm (6 inches)',
            reason:
              'Just 15 cm of fast-moving floodwater can knock an adult off their feet onto submerged hazards.',
          },
          {
            prohibition: 'Do NOT drive into flooded roadways or underpasses ("Turn Around, Don’t Drown")',
            reason:
              '30 cm (1 foot) of water floats most passenger cars, and 60 cm (2 feet) sweeps SUVs and trucks off the road.',
          },
          {
            prohibition: 'Do NOT camp or shelter near storm drains, culverts, or river embankments',
            reason:
              'Culverts create violent suction vortices that pull swimmers underwater.',
          },
        ],
        medicalGuidance:
          'RF 2.4 GHz signals attenuate heavily in water—hold your device high above water level when broadcasting SOS beacons.',
      },
    ],
  },
  landslide: {
    id: 'landslide',
    title: 'Landslide, Mudflow & Slope Failure Protocol',
    subtitle:
      'Hillside debris flow evasion, acoustic & visual slope warning signs, and post-slide extraction triage.',
    telemetryTag: 'Geotechnical Slope Failure · Primary Hazard: High-Velocity Debris Flow & Burial',
    scenarios: [
      {
        id: 'ls-active-slide',
        label: 'Active Hillside Slide / Debris Flow',
        severity: 'CRITICAL',
        summary:
          'Immediate survival maneuvers when hillside soil, rock, or saturated mudflow begins accelerating downslope.',
        recommendedSosCategory: 'Medical / Structural Collapse',
        recommendedSosMessage:
          'Caught in hillside landslide / mudflow zone. Need urgent medical and search extraction.',
        whatToDo: [
          {
            step: '01. Evacuate Perpendicular to the Debris Flow Path',
            detail:
              'Move laterally (sideways) toward higher stable ridge ground—never try to outrun a landslide straight downhill.',
          },
          {
            step: '02. Curl Into a Tight Ball & Protect Your Head if Escape is Impossible',
            detail:
              'If overtaken by sliding debris, curl into a tight fetal ball, clasp hands firmly behind your neck, and shield your head.',
          },
          {
            step: '03. Move to Upper Floors on the Upslope/Lateral Side if Trapped Indoors',
            detail:
              'If inside a building that cannot be evacuated in time, move to the second story and shelter under sturdy furniture.',
          },
          {
            step: '04. Trigger CRITICAL Medical SOS with Last Known GPS',
            detail:
              'Activate your AetherMesh SOS immediately so your coordinates are cached by nearby relay nodes before mudflow burial.',
          },
        ],
        whatNotToDo: [
          {
            prohibition: 'Do NOT run straight downhill ahead of a moving mudflow or rockslide',
            reason:
              'Debris flows travel at 30 to 55+ km/h and accelerate down valleys and drainage channels.',
          },
          {
            prohibition: 'Do NOT cross active debris channels, gorges, or swollen mountain streams',
            reason:
              'Upstream landslide dams frequently burst without warning, sending a secondary wall of mud and boulders down the channel.',
          },
          {
            prohibition: 'Do NOT shelter behind trees, cars, or unreinforced sheds in the flow path',
            reason:
              'Saturated mudflows uproot mature trees and crush vehicles effortlessly.',
          },
          {
            prohibition: 'Do NOT return to the slide zone after the first wave stops',
            reason:
              'Retrogressive slope failures and secondary mudslides commonly follow within minutes to hours.',
          },
        ],
        medicalGuidance:
          'Landslide victims face high rates of airway obstruction from wet mud and chest compression. Keep airway clear and broadcast CRITICAL status.',
      },
      {
        id: 'ls-warning-signs',
        label: 'Pre-Slide Warning Signs & Post-Slide Rescue',
        severity: 'URGENT',
        summary:
          'Recognizing imminent geotechnical failure indicators and assisting trapped neighbors safely.',
        recommendedSosCategory: 'Structural Collapse / Trapped',
        recommendedSosMessage:
          'Hillside slope fracturing and utility rupture detected. Requesting evacuation support.',
        whatToDo: [
          {
            step: '01. Watch for Sudden Changes in Stream Water & Ground Cracks',
            detail:
              'Immediate warning signs include stream water suddenly turning muddy, water levels dropping abruptly, or new cracks in foundations and retaining walls.',
          },
          {
            step: '02. Listen for Cracking Trees, Rumbling, or Shifting Boulders',
            detail:
              'Faint rumbling noises that grow louder or popping sounds from tree roots indicate imminent slope mobilization.',
          },
          {
            step: '03. Direct Rescuers to Survivor Azimuth Without Stepping on Loose Mud',
            detail:
              'Use AetherMesh Azimuth Radar to pinpoint trapped nodes and relay their coordinates to equipped Geotechnical Rescue teams.',
          },
          {
            step: '04. Monitor for Ruptured Gas, Water, and Electrical Lines',
            detail:
              'Ground shear severs underground utilities; report broken infrastructure immediately via mesh notes.',
          },
        ],
        whatNotToDo: [
          {
            prohibition: 'Do NOT walk onto freshly deposited wet mudflows without rescue planking',
            reason:
              'Saturated slide deposits behave like quicksand and can liquefy under footstep vibrations.',
          },
          {
            prohibition: 'Do NOT sleep in ground-floor rooms facing a steep saturated hillside during heavy rain',
            reason:
              'Nocturnal debris flows strike ground-floor bedrooms against hillside retaining walls first.',
          },
          {
            prohibition: 'Do NOT excavate at the toe (bottom) of an unstable slide pile',
            reason:
              'Removing mass from the toe of a landslide removes support and triggers an immediate secondary collapse from above.',
          },
        ],
        medicalGuidance:
          'Treat rescued landslide victims for both crush injuries and severe hypothermia caused by cold wet mud.',
      },
    ],
  },
};

interface DisasterProtocolsProps {
  snapshot: MeshSnapshot;
  onDispatchDisasterSos: (params: {
    category: string;
    message: string;
    status: MedicalStatus;
    blood_type: BloodType;
  }) => void;
}

export const DisasterProtocols: React.FC<DisasterProtocolsProps> = ({
  snapshot,
  onDispatchDisasterSos,
}) => {
  const [selectedDisaster, setSelectedDisaster] = useState<DisasterType>('earthquake');
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState<number>(0);
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [bloodType, setBloodType] = useState<BloodType>(snapshot.blood_type || 'O+');
  const [medicalStatus, setMedicalStatus] = useState<MedicalStatus>(
    snapshot.medical_status || 'CRITICAL'
  );
  const [customMessage, setCustomMessage] = useState<string>(
    'Trapped under debris, need medical assistance.'
  );
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [dispatchedBanner, setDispatchedBanner] = useState<string | null>(null);

  const activeDisaster = DISASTER_PROTOCOLS[selectedDisaster];
  const activeScenario =
    activeDisaster.scenarios[selectedScenarioIdx] || activeDisaster.scenarios[0];

  const handleSelectDisaster = (type: DisasterType) => {
    setSelectedDisaster(type);
    setSelectedScenarioIdx(0);
    const firstScenario = DISASTER_PROTOCOLS[type].scenarios[0];
    setMedicalStatus(firstScenario.severity);
    setCustomMessage(firstScenario.recommendedSosMessage);
    setDispatchedBanner(null);
  };

  const handleSelectScenario = (idx: number) => {
    setSelectedScenarioIdx(idx);
    const sc = activeDisaster.scenarios[idx];
    if (sc) {
      setMedicalStatus(sc.severity);
      setCustomMessage(sc.recommendedSosMessage);
    }
    setDispatchedBanner(null);
  };

  const toggleStepCheck = (key: string) => {
    setCheckedSteps((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const previewPayload = {
    node_id: snapshot.node_id,
    status: medicalStatus,
    blood_type: bloodType,
    gps_last_known: [snapshot.latitude, snapshot.longitude] as [number, number],
    message: customMessage,
  };

  const handleCopyPayload = () => {
    navigator.clipboard?.writeText(JSON.stringify(previewPayload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1800);
  };

  const handleTriggerDisasterSos = () => {
    onDispatchDisasterSos({
      category: activeScenario.recommendedSosCategory,
      message: customMessage,
      status: medicalStatus,
      blood_type: bloodType,
    });
    setDispatchedBanner(
      `Medical SOS broadcasted for ${activeDisaster.id.toUpperCase()} (${medicalStatus} · Blood ${bloodType})`
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Disaster Selection & Situation Bar */}
      <section className="bg-[#0E131D] border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-800/90">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold tracking-tight text-slate-100">
              Natural Disaster Survival &amp; Emergency Medical Action Protocols
            </h2>
            <p className="text-xs text-slate-400">
              Offline field decision system: select a natural hazard to inspect verified{' '}
              <strong className="text-slate-200">What To Do</strong> and{' '}
              <strong className="text-slate-200">What NOT To Do</strong> protocols and dispatch
              medical triage telemetry.
            </p>
          </div>

          {/* 3 Disaster Mode Buttons: Earthquake | Flood | Landslide */}
          <div className="flex items-center gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-lg">
            {(
              [
                { id: 'earthquake', label: 'Earthquake' },
                { id: 'flood', label: 'Flood' },
                { id: 'landslide', label: 'Landslide' },
              ] as const
            ).map((tab) => {
              const isSelected = selectedDisaster === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectDisaster(tab.id)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Hazard Header & Scenario Selector */}
        <div className="px-5 py-4 bg-[#090D14] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-cyan-400">
              <span>{activeDisaster.telemetryTag}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-100 font-display">
              {activeDisaster.title}
            </h3>
            <p className="text-xs text-slate-400 max-w-2xl">{activeDisaster.subtitle}</p>
          </div>

          {/* Scenario / Field Condition Selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-mono text-slate-400">
              Select Field Situation / Condition:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {activeDisaster.scenarios.map((sc, idx) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => handleSelectScenario(idx)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    selectedScenarioIdx === idx
                      ? 'bg-slate-800 text-slate-100 border border-slate-600'
                      : 'bg-[#0E131D] text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Two-Column Split: WHAT TO DO vs WHAT NOT TO DO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80">
          {/* Left Column: WHAT TO DO */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <h4 className="text-sm font-semibold text-emerald-300">
                  What You MUST Do ({activeScenario.label})
                </h4>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Click steps to mark complete
              </span>
            </div>

            <div className="space-y-3">
              {activeScenario.whatToDo.map((item, idx) => {
                const checkKey = `${activeScenario.id}-${idx}`;
                const isDone = Boolean(checkedSteps[checkKey]);
                return (
                  <div
                    key={checkKey}
                    onClick={() => toggleStepCheck(checkKey)}
                    className={`p-3.5 rounded-lg border transition-colors cursor-pointer ${
                      isDone
                        ? 'bg-emerald-950/20 border-emerald-700/50'
                        : 'bg-[#090D14] border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`text-xs font-semibold ${
                          isDone ? 'text-emerald-300 line-through' : 'text-slate-100'
                        }`}
                      >
                        {item.step}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-400 shrink-0">
                        {isDone ? '✓ Done' : 'Pending'}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">{item.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: WHAT NOT TO DO */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <h4 className="text-sm font-semibold text-rose-300">
                  What You Must NOT Do (Critical Prohibitions)
                </h4>
              </div>
              <span className="text-xs font-mono text-rose-400">✖ High Lethality Risk</span>
            </div>

            <div className="space-y-3">
              {activeScenario.whatNotToDo.map((item, idx) => (
                <div
                  key={`${activeScenario.id}-not-${idx}`}
                  className="p-3.5 rounded-lg bg-[#090D14] border border-rose-900/40 space-y-1.5"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono font-bold text-rose-400 shrink-0">✖</span>
                    <span className="text-xs font-semibold text-rose-200">
                      {item.prohibition}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed pl-4">{item.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Field Medical Guidance Note */}
        <div className="px-5 py-3.5 bg-[#090D14] border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <HeartPulse className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong className="text-slate-100">Field Medical Triage Note:</strong>{' '}
              {activeScenario.medicalGuidance}
            </span>
          </div>
          <span className="font-mono text-slate-400 tabular-nums">
            Triage Priority: {activeScenario.severity}
          </span>
        </div>
      </section>

      {/* Medical Assistance & Emergency Packet Dispatcher */}
      <section className="bg-[#0E131D] border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800/90">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <h3 className="text-sm font-semibold text-slate-100">
              Medical Assistance Telemetry &amp; Direct SOS Packet Dispatch
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            Node: {snapshot.node_id} · GPS: [{snapshot.latitude.toFixed(4)},{' '}
            {snapshot.longitude.toFixed(4)}]
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80">
          {/* Left Form: Medical Triage Parameters */}
          <div className="lg:col-span-7 p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Medical Triage Status</label>
                <select
                  value={medicalStatus}
                  onChange={(e) => setMedicalStatus(e.target.value as MedicalStatus)}
                  className="w-full px-3 py-1.5 text-xs font-mono bg-[#07090E] border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="URGENT">URGENT</option>
                  <option value="STABLE">STABLE</option>
                  <option value="STANDBY">STANDBY</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Patient Blood Type</label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value as BloodType)}
                  className="w-full px-3 py-1.5 text-xs font-mono bg-[#07090E] border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as BloodType[]).map(
                    (bt) => (
                      <option key={bt} value={bt}>
                        {bt}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Last Known GPS</label>
                <div className="px-3 py-1.5 text-xs font-mono tabular-nums bg-[#07090E] border border-slate-800 rounded-lg text-cyan-300 truncate">
                  [{snapshot.latitude}, {snapshot.longitude}]
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Emergency Medical Assistance Message
              </label>
              <input
                type="text"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                maxLength={120}
                className="w-full px-3 py-2 text-xs bg-[#07090E] border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleTriggerDisasterSos}
                className="px-4 py-2.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <AlertOctagon className="w-4 h-4 shrink-0" />
                Request Medical Assistance Over Mesh
              </button>

              <button
                type="button"
                onClick={() => {
                  setMedicalStatus('CRITICAL');
                  setBloodType('O+');
                  setCustomMessage('Trapped under debris, need medical assistance.');
                }}
                className="px-3.5 py-2.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Load Subhajit_Device_01 Critical Preset
              </button>
            </div>

            {dispatchedBanner && (
              <div className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{dispatchedBanner}</span>
              </div>
            )}
          </div>

          {/* Right Live JSON Frame Preview */}
          <div className="lg:col-span-5 p-5 bg-[#090D14] flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">
                UDP Medical Assistance Frame Payload
              </span>
              <button
                type="button"
                onClick={handleCopyPayload}
                className="px-2.5 py-1 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {copiedJson ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    Copy JSON
                  </>
                )}
              </button>
            </div>

            <pre className="p-3.5 rounded-lg bg-[#07090E] border border-slate-800/90 text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed">
              {JSON.stringify(previewPayload, null, 2)}
            </pre>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Broadcast UDP :{snapshot.config.port}</span>
              <span>TTL: {snapshot.config.ttl_limit} Hops</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
