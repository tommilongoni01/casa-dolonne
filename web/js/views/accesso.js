// Accesso con email e codice a 6 cifre ricevuto per posta (niente password da ricordare).
import { stato, inviaCodice, verificaCodice, esci } from '../store.js';

export const Accesso = {
    template: `
      <div class="accesso">
        <img src="icone/icona-180.png" alt="">
        <h1>Casa Dolonne</h1>
        <div class="modulo">
          <template v-if="!codiceInviato">
            <p class="secondario" style="text-align:center">Inserisci la tua email: riceverai un codice di accesso.</p>
            <input class="grande" type="email" v-model="email" placeholder="nome@email.it" autocomplete="email"
                   autocapitalize="off" @keyup.enter="invia">
            <button class="pulsante-pieno" :disabled="!emailValida || inCorso" @click="invia">
              {{ inCorso ? 'Invio…' : 'Invia codice' }}
            </button>
          </template>
          <template v-else>
            <p class="secondario" style="text-align:center">Abbiamo inviato un codice a <b>{{ email }}</b>.<br>Scrivilo qui sotto.</p>
            <input class="grande" inputmode="numeric" autocomplete="one-time-code" maxlength="8" v-model="codice"
                   placeholder="123456" @keyup.enter="verifica">
            <button class="pulsante-pieno" :disabled="codice.trim().length < 6 || inCorso" @click="verifica">
              {{ inCorso ? 'Verifica…' : 'Entra' }}
            </button>
            <button class="pulsante-secondario" @click="codiceInviato = false; codice = ''">Cambia email</button>
          </template>
          <p v-if="errore" class="errore">{{ errore }}</p>
        </div>
      </div>`,
    data() { return { email: localStorage.getItem('casaDolonne.email') ?? '', codice: '', codiceInviato: false, inCorso: false, errore: '' }; },
    computed: { emailValida() { return /^\S+@\S+\.\S+$/.test(this.email.trim()); } },
    methods: {
        async invia() {
            if (!this.emailValida) return;
            this.inCorso = true; this.errore = '';
            try {
                await inviaCodice(this.email);
                localStorage.setItem('casaDolonne.email', this.email.trim().toLowerCase());
                this.codiceInviato = true;
            } catch (e) { this.errore = `Invio non riuscito: ${e.message}`; }
            finally { this.inCorso = false; }
        },
        async verifica() {
            this.inCorso = true; this.errore = '';
            try { await verificaCodice(this.email, this.codice); }
            catch (e) { this.errore = 'Codice non valido o scaduto. Riprova o richiedine uno nuovo.'; }
            finally { this.inCorso = false; }
        }
    }
};

export const NonAutorizzato = {
    template: `
      <div class="accesso">
        <img src="icone/icona-180.png" alt="">
        <h1>Accesso non abilitato</h1>
        <p class="secondario" style="text-align:center; max-width:380px">
          L'email <b>{{ stato.utente.email }}</b> non è tra i familiari registrati.
          Chiedi a chi gestisce l'app di aggiungerti in Impostazioni → Famiglia, poi riapri l'app.
        </p>
        <div class="modulo"><button class="pulsante-secondario" @click="esci">Esci e usa un'altra email</button></div>
      </div>`,
    setup() { return { stato, esci }; }
};
