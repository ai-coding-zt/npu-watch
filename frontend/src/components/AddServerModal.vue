<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useServersStore } from '@/stores/servers';
import type { ServerConfig, CreateServerRequest } from '@/types';

const props = defineProps<{
  server?: ServerConfig | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const serversStore = useServersStore();

const isEditing = computed(() => !!props.server);

const form = ref<CreateServerRequest>({
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password',
  password: '',
  privateKey: '',
  passphrase: ''
});

const saving = ref(false);
const error = ref('');

watch(() => props.server, (server) => {
  if (server) {
    form.value = {
      name: server.name,
      host: server.host,
      port: server.port,
      username: server.username,
      authType: server.authType,
      password: '',
      privateKey: '',
      passphrase: ''
    };
  } else {
    resetForm();
  }
}, { immediate: true });

function resetForm() {
  form.value = {
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password',
    password: '',
    privateKey: '',
    passphrase: ''
  };
  error.value = '';
}

async function handleSubmit() {
  error.value = '';
  
  if (!form.value.name || !form.value.host || !form.value.username) {
    error.value = 'Please fill in all required fields';
    return;
  }

  if (form.value.authType === 'password' && !form.value.password && !isEditing.value) {
    error.value = 'Password is required';
    return;
  }

  if (form.value.authType === 'key' && !form.value.privateKey && !isEditing.value) {
    error.value = 'Private key is required';
    return;
  }

  saving.value = true;
  try {
    if (isEditing.value && props.server) {
      const updateData: Record<string, unknown> = { ...form.value };
      if (!updateData.password) delete updateData.password;
      if (!updateData.privateKey) delete updateData.privateKey;
      if (!updateData.passphrase) delete updateData.passphrase;
      await serversStore.updateServer(props.server.id, updateData);
    } else {
      await serversStore.createServer(form.value);
    }
    emit('saved');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to save server';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">{{ isEditing ? 'Edit Server' : 'Add Server' }}</h2>
        <p class="modal-subtitle">
          {{ isEditing ? 'Update server connection details' : 'Configure a new NPU server connection' }}
        </p>
      </div>

      <form @submit.prevent="handleSubmit">
        <div class="modal-body">
          <div v-if="error" class="form-error">{{ error }}</div>

          <div class="form-group">
            <label class="form-label">Server Name *</label>
            <input
              v-model="form.name"
              type="text"
              class="form-input"
              placeholder="e.g., Production NPU Server"
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Host *</label>
              <input
                v-model="form.host"
                type="text"
                class="form-input"
                placeholder="e.g., 175.99.1.3"
              />
            </div>
            <div class="form-group form-group--small">
              <label class="form-label">Port</label>
              <input
                v-model.number="form.port"
                type="number"
                class="form-input"
                placeholder="22"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Username *</label>
            <input
              v-model="form.username"
              type="text"
              class="form-input"
              placeholder="e.g., root"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Authentication Type</label>
            <div class="auth-toggle">
              <button
                type="button"
                class="auth-btn"
                :class="{ active: form.authType === 'password' }"
                @click="form.authType = 'password'"
              >
                Password
              </button>
              <button
                type="button"
                class="auth-btn"
                :class="{ active: form.authType === 'key' }"
                @click="form.authType = 'key'"
              >
                SSH Key
              </button>
            </div>
          </div>

          <div v-if="form.authType === 'password'" class="form-group">
            <label class="form-label">{{ isEditing ? 'New Password (leave empty to keep)' : 'Password *' }}</label>
            <input
              v-model="form.password"
              type="password"
              class="form-input"
              placeholder="Enter password"
            />
          </div>

          <template v-else>
            <div class="form-group">
              <label class="form-label">{{ isEditing ? 'New Private Key (leave empty to keep)' : 'Private Key *' }}</label>
              <textarea
                v-model="form.privateKey"
                class="form-input form-textarea"
                placeholder="Paste your private key here"
                rows="4"
              ></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Passphrase (if required)</label>
              <input
                v-model="form.passphrase"
                type="password"
                class="form-input"
                placeholder="Enter passphrase"
              />
            </div>
          </template>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="emit('close')">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Server') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.form-row {
  display: flex;
  gap: var(--spacing-md);
}

.form-group--small {
  width: 100px;
  flex-shrink: 0;
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
  font-family: var(--font-mono);
  font-size: 12px;
}

.auth-toggle {
  display: flex;
  gap: var(--spacing-xs);
}

.auth-btn {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--bg-secondary);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  color: var(--text-normal);
  transition: all var(--transition-fast);
}

.auth-btn:hover {
  background-color: var(--bg-modifier-hover);
}

.auth-btn.active {
  background-color: var(--brand-experiment);
  border-color: var(--brand-experiment);
  color: white;
}
</style>
