import { ref } from 'vue';

const message = ref(null);
const type = ref('info');
let timer = null;

export function useToast() {
  function show(msg, t = 'info') {
    clearTimeout(timer);
    message.value = msg;
    type.value = t;
    timer = setTimeout(() => { message.value = null; }, 3500);
  }
  return { message, type, show };
}
