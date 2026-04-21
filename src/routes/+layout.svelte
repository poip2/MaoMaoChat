<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { initThemeListener } from "$lib/stores/theme";

  onMount(() => {
    initThemeListener();
  });
</script>

<slot />
