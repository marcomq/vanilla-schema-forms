<script>
  export let elementId;
  export let node;
  export let value;
  export let name;
</script>

<div class="mb-3">
  <label for={elementId} class="form-label">
    {node.title}
  </label>
  <input 
    type="text" 
    class="form-control" 
    id={elementId} 
    name={name} 
    bind:value={value} 
  />
</div>
