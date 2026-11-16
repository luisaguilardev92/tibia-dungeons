import { Component, signal } from '@angular/core';

interface Enemy {
  name: string;
  short: string;
  type: string;
  hp: number;
  attack: number;
  experience: number;
  boss: boolean;
}

interface SkillProgress {
  key: 'fist' | 'club' | 'sword' | 'axe' | 'distance' | 'shield' | 'fishing' | 'magic';
  name: string;
  level: number;
  tries: number;
  progress: number;
  training: boolean;
}

interface LootItem {
  id: 'gold-coin' | 'cheese';
  name: string;
  sprite: string;
  quantity: number;
}

interface GameState {
  run: number;
  floor: number;
  level: number;
  experience: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  attack: number;
  defense: number;
  crit: number;
  speed: number;
  active: boolean;
  betweenFloors: boolean;
  defeated: boolean;
  enemy: Enemy;
  enemyHp: number;
}

interface LogEntry {
  time: string;
  message: string;
  kind: string;
}

interface SavedGame {
  gameState: GameState;
  bag: LootItem[];
  skills: SkillProgress[];
  logs: LogEntry[];
}

const SERVER_RATES = { experience: 5, skill: 3 };
const INITIAL_SKILLS: SkillProgress[] = [
  { key: 'fist', name: 'Fist Fighting', level: 10, tries: 0, progress: 0, training: true },
  { key: 'club', name: 'Club Fighting', level: 10, tries: 0, progress: 0, training: false },
  { key: 'sword', name: 'Sword Fighting', level: 10, tries: 0, progress: 0, training: false },
  { key: 'axe', name: 'Axe Fighting', level: 10, tries: 0, progress: 0, training: false },
  { key: 'distance', name: 'Distance Fighting', level: 10, tries: 0, progress: 0, training: false },
  { key: 'shield', name: 'Shielding', level: 10, tries: 0, progress: 0, training: false },
  { key: 'fishing', name: 'Fishing', level: 10, tries: 0, progress: 0, training: false },
  { key: 'magic', name: 'Magic Level', level: 0, tries: 0, progress: 0, training: false },
];

const RAT: Enemy = { name: 'Rat', short: 'RAT', type: 'CRIATURA · COMÚN', hp: 35, attack: 5, experience: 5, boss: false };

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly ready = signal(false);
  readonly state = signal<GameState>({
    run: 1, floor: 1, level: 1, experience: 0, hp: 100, maxHp: 100, mana: 60, maxMana: 60, attack: 12, defense: 2,
    crit: 5, speed: 1, active: false, betweenFloors: false, defeated: false,
    enemy: RAT, enemyHp: RAT.hp,
  });
  readonly bag = signal<LootItem[]>([]);
  readonly skills = signal<SkillProgress[]>(INITIAL_SKILLS.map((skill) => ({ ...skill })));
  readonly logs = signal<LogEntry[]>([{ time: '—', message: 'Las catacumbas aguardan.', kind: 'muted' }]);
  readonly heroDamage = signal<number | null>(null);
  readonly enemyDamage = signal<number | null>(null);
  readonly enemyHit = signal(false);
  readonly enemyDefeated = signal(false);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private saveId = '';
  private saveQueue = Promise.resolve();

  constructor() { void this.restoreGame(); }

  get s(): GameState { return this.state(); }
  get levelExperience(): number { return this.experienceForLevel(this.s.level); }
  get nextLevelExperience(): number { return this.experienceForLevel(this.s.level + 1); }
  get experienceProgress(): number {
    const range = this.nextLevelExperience - this.levelExperience;
    return range > 0 ? Math.min(100, (this.s.experience - this.levelExperience) / range * 100) : 100;
  }
  get effectiveAttack(): number {
    const fist = this.skills().find((skill) => skill.key === 'fist')?.level ?? 10;
    return this.s.attack + fist - 10 + Math.floor((this.s.level - 1) / 5);
  }
  get status(): string {
    return this.s.defeated ? 'EXPEDICIÓN FINALIZADA' : this.s.active ? 'DESCENSO EN CURSO' : this.s.betweenFloors ? 'BOTÍN RECOGIDO' : 'LISTO PARA DESCENDER';
  }
  get battleMessage(): string {
    return this.s.defeated ? 'Has caído en las catacumbas.' : this.s.betweenFloors ? 'El botín cayó en tu bolsa. Siguiente piso en camino.' : this.s.active ? 'El combate continúa automáticamente.' : 'Tu viaje empieza aquí.';
  }
  get startDisabled(): boolean { return !this.ready() || this.s.active || this.s.betweenFloors || this.s.defeated; }
  get startLabel(): string {
    return this.s.defeated ? 'EXPEDICIÓN TERMINADA' : this.s.betweenFloors ? 'BOTÍN A LA BOLSA' : this.s.active ? 'DESCENSO EN CURSO' : 'INICIAR DESCENSO';
  }
  get combatBanner(): string { return this.s.enemy.boss ? 'EL RAT DESPIERTA' : this.s.active ? 'EL COMBATE CONTINÚA' : 'UNA PRESENCIA TE OBSERVA'; }

  startFloor(): void {
    if (this.startDisabled) return;
    const enemy = this.scaledEnemy(this.s.floor);
    this.enemyDefeated.set(false);
    this.state.update((s) => ({ ...s, enemy, enemyHp: enemy.hp, active: true }));
    this.addLog(`${enemy.name} bloquea el pasaje${enemy.boss ? ' · JEFE' : ''}.`);
    this.persistGame();
    this.schedule(500 / this.s.speed);
  }

  toggleSpeed(): void {
    this.state.update((s) => ({ ...s, speed: s.speed === 1 ? 2 : s.speed === 2 ? 3 : 1 }));
    this.persistGame();
    if (this.s.active) {
      clearTimeout(this.timer);
      this.schedule(1500 / this.s.speed);
    }
  }

  resetRun(): void {
    clearTimeout(this.timer);
    const run = this.s.run + 1;
    this.state.set({
      run, floor: 1, level: 1, experience: 0, hp: 100, maxHp: 100, mana: 60, maxMana: 60, attack: 12, defense: 2,
      crit: 5, speed: 1, active: false, betweenFloors: false, defeated: false,
      enemy: RAT, enemyHp: RAT.hp,
    });
    this.bag.set([]);
    this.skills.set(INITIAL_SKILLS.map((skill) => ({ ...skill })));
    this.enemyDefeated.set(false);
    this.logs.set([]);
    this.addLog('Nueva expedición. Las catacumbas aguardan.', 'muted');
    this.persistGame();
  }

  clearHeroDamage(): void { this.heroDamage.set(null); }
  clearEnemyDamage(): void { this.enemyDamage.set(null); }

  private schedule(delay: number): void { this.timer = setTimeout(() => this.tick(), delay); }

  private scaledEnemy(floor: number): Enemy {
    const scale = 1 + Math.floor((floor - 1) / 5) * 0.55;
    const boss = floor % 5 === 0;
    return {
      ...RAT,
      name: boss ? 'Rat guardián' : RAT.name,
      short: boss ? 'RAT GUARDIÁN' : RAT.short,
      type: boss ? 'JEFE · RAT' : RAT.type,
      hp: Math.round(RAT.hp * scale * (boss ? 2.5 : 1)),
      attack: Math.round(RAT.attack * scale * (boss ? 1.6 : 1)),
      boss,
    };
  }

  private tick(): void {
    if (!this.s.active) return;
    const critical = Math.random() * 100 < this.s.crit;
    const hit = Math.round(this.effectiveAttack * (critical ? 1.8 : 1));
    const enemyHp = Math.max(0, this.s.enemyHp - hit);
    this.enemyDamage.set(hit);
    this.enemyHit.set(true);
    setTimeout(() => this.enemyHit.set(false), 240);
    this.state.update((s) => ({ ...s, enemyHp }));
    this.advanceSkill('fist');
    this.addLog(`Golpeas a ${this.s.enemy.name.toLowerCase()} por ${hit}${critical ? ' · CRÍTICO' : ''}.`);
    if (enemyHp <= 0) { this.winFloor(); return; }

    const incoming = Math.max(1, this.s.enemy.attack - this.s.defense);
    const hp = Math.max(0, this.s.hp - incoming);
    this.heroDamage.set(incoming);
    this.state.update((s) => ({ ...s, hp }));
    this.addLog(`${this.s.enemy.name} te inflige ${incoming} de daño.`);
    if (hp <= 0) {
      this.state.update((s) => ({ ...s, active: false, defeated: true }));
      this.addLog('La expedición termina. Reúne fuerzas e inténtalo de nuevo.', 'muted');
      this.persistGame();
      return;
    }
    this.persistGame();
    this.schedule(1500 / this.s.speed);
  }

  private winFloor(): void {
    const defeatedEnemy = this.s.enemy.name;
    const nextFloor = this.s.floor + 1;
    const goldCount = Math.floor(Math.random() * 4) + 1;
    const experience = this.s.enemy.experience * SERVER_RATES.experience;
    this.enemyDefeated.set(true);
    this.state.update((s) => ({ ...s, active: false, betweenFloors: true, floor: nextFloor }));
    this.gainExperience(experience);
    this.addLog(`Ganas ${experience} puntos de experiencia.`, 'loot');
    this.addLoot('gold-coin', 'Gold Coin', 'assets/tibia-local/gold-coin.png', goldCount);
    this.addLog(`${defeatedEnemy} cae. Suelta ${goldCount} ${goldCount === 1 ? 'moneda' : 'monedas'} de oro.`, 'loot');
    if (Math.random() < 0.3941) {
      this.addLoot('cheese', 'Cheese', 'assets/tibia-local/cheese.png', 1);
      this.addLog(`${defeatedEnemy} también suelta queso.`, 'loot');
    }
    this.addLog('El botín cae en tu bolsa.', 'loot');
    this.persistGame();
    this.timer = setTimeout(() => {
      this.state.update((s) => ({ ...s, betweenFloors: false }));
      this.startFloor();
    }, 1700);
  }

  private experienceForLevel(level: number): number {
    return Math.floor((((level - 6) * level + 17) * level - 12) / 6) * 100;
  }

  private gainExperience(amount: number): void {
    const previousLevel = this.s.level;
    let level = previousLevel;
    let maxHp = this.s.maxHp;
    let maxMana = this.s.maxMana;
    const experience = this.s.experience + amount;
    while (experience >= this.experienceForLevel(level + 1)) {
      level += 1;
      maxHp += 5;
      maxMana += 5;
    }
    this.state.update((s) => ({
      ...s,
      experience,
      level,
      maxHp,
      maxMana,
      hp: level > s.level ? maxHp : s.hp,
      mana: level > s.level ? maxMana : s.mana,
    }));
    if (level > previousLevel) this.addLog(`¡Subiste al nivel ${level}! Salud y maná aumentaron.`, 'loot');
  }

  private advanceSkill(key: SkillProgress['key']): void {
    let advancedLevel = 0;
    this.skills.update((skills) => skills.map((skill) => {
      if (skill.key !== key || !skill.training) return skill;
      let level = skill.level;
      let tries = skill.tries + SERVER_RATES.skill;
      let needed = Math.ceil(50 * Math.pow(1.5, level - 10));
      while (tries >= needed) {
        tries -= needed;
        level += 1;
        needed = Math.ceil(50 * Math.pow(1.5, level - 10));
      }
      if (level > skill.level) advancedLevel = level;
      return { ...skill, level, tries, progress: Math.min(100, tries / needed * 100) };
    }));
    if (advancedLevel) this.addLog(`Fist Fighting avanzó a nivel ${advancedLevel}.`, 'loot');
  }

  skillProgressLabel(skill: SkillProgress): string {
    return skill.training ? `${Math.floor(skill.progress)}% HACIA ${skill.level + 1}` : 'SIN ENTRENAR';
  }

  private addLoot(id: LootItem['id'], name: string, sprite: string, quantity: number): void {
    this.bag.update((items) => {
      const found = items.find((item) => item.id === id);
      if (found) return items.map((item) => item.id === id ? { ...item, quantity: item.quantity + quantity } : item);
      return [...items, { id, name, sprite, quantity }];
    });
  }

  private addLog(message: string, kind = ''): void {
    const time = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
    this.logs.update((entries) => [{ time, message, kind }, ...entries].slice(0, 5));
  }

  private async restoreGame(): Promise<void> {
    this.saveId = localStorage.getItem('tibia-dungeons-save-id') ?? localStorage.getItem('umbral-save-id') ?? '';
    try {
      if (this.saveId) {
        const response = await fetch(`/api/games/${this.saveId}`);
        if (response.ok) {
          const saved = await response.json() as { state: SavedGame };
          this.applySave(saved.state);
          this.ready.set(true);
          return;
        }
      }
      const response = await fetch('/api/games', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameState: this.s, bag: this.bag(), skills: this.skills(), logs: this.logs() }),
      });
      if (!response.ok) throw new Error('No se pudo crear la partida guardada.');
      const created = await response.json() as { id: string };
      this.saveId = created.id;
      localStorage.setItem('tibia-dungeons-save-id', this.saveId);
      this.ready.set(true);
    } catch (error) {
      console.error('No se pudo conectar con el backend de Tibia Dungeons.', error);
      this.addLog('No se pudo conectar con el servidor de guardado.', 'muted');
    }
  }

  private applySave(saved: SavedGame): void {
    this.state.set(saved.gameState);
    this.bag.set(saved.bag);
    this.skills.set(saved.skills);
    this.logs.set(saved.logs);
  }

  private persistGame(): void {
    if (!this.saveId || !this.ready()) return;
    const saved: SavedGame = { gameState: this.s, bag: this.bag(), skills: this.skills(), logs: this.logs() };
    this.saveQueue = this.saveQueue.then(async () => {
      const response = await fetch(`/api/games/${this.saveId}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(saved),
      });
      if (!response.ok) throw new Error('No se pudo guardar la partida.');
    }).catch((error) => console.error('Error guardando la partida de Tibia Dungeons.', error));
  }
}
