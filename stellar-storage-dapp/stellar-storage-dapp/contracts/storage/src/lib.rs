#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    log, symbol_short,
    Address, Env, Map, String, Symbol, Vec,
};

// ─────────────────────────────────────────────
//  Storage Keys
// ─────────────────────────────────────────────

const STORE: Symbol = symbol_short!("STORE");
const KEYS: Symbol = symbol_short!("KEYS");

// ─────────────────────────────────────────────
//  Custom Types
// ─────────────────────────────────────────────

/// A single key-value entry stored on-chain.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Entry {
    pub key: String,
    pub value: String,
    pub owner: Address,
    pub timestamp: u64,
}

/// Error codes returned by the contract.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum StorageError {
    KeyNotFound = 1,
    KeyAlreadyExists = 2,
    Unauthorized = 3,
    KeyTooLong = 4,
    ValueTooLong = 5,
}

// ─────────────────────────────────────────────
//  Contract Definition
// ─────────────────────────────────────────────

#[contract]
pub struct StorageContract;

#[contractimpl]
impl StorageContract {

    // ─────────────────────────────────────────
    //  WRITE: store a key-value pair
    // ─────────────────────────────────────────

    /// Store a new key-value pair.
    /// The caller must authorise the transaction — they become the owner.
    /// Returns an error if the key already exists (use `update` to overwrite).
    pub fn set(
        env: Env,
        owner: Address,
        key: String,
        value: String,
    ) -> Result<(), StorageError> {
        // Require the caller to sign this transaction
        owner.require_auth();

        // Enforce key / value length limits
        if key.len() > 64 {
            return Err(StorageError::KeyTooLong);
        }
        if value.len() > 256 {
            return Err(StorageError::ValueTooLong);
        }

        // Load (or initialise) the main store map
        let mut store: Map<String, Entry> = env
            .storage()
            .persistent()
            .get(&STORE)
            .unwrap_or(Map::new(&env));

        // Prevent accidental overwrite — use `update` for that
        if store.contains_key(key.clone()) {
            return Err(StorageError::KeyAlreadyExists);
        }

        // Build the entry
        let entry = Entry {
            key: key.clone(),
            value,
            owner: owner.clone(),
            timestamp: env.ledger().timestamp(),
        };

        store.set(key.clone(), entry);
        env.storage().persistent().set(&STORE, &store);

        // Track the key in the index so `list_keys` can return it
        let mut keys: Vec<String> = env
            .storage()
            .persistent()
            .get(&KEYS)
            .unwrap_or(Vec::new(&env));
        keys.push_back(key.clone());
        env.storage().persistent().set(&KEYS, &keys);

        log!(&env, "set: key={}", key);
        Ok(())
    }

    // ─────────────────────────────────────────
    //  READ: retrieve a value by key
    // ─────────────────────────────────────────

    /// Return the full Entry for a given key.
    /// Anyone can read — no authorisation required.
    pub fn get(env: Env, key: String) -> Result<Entry, StorageError> {
        let store: Map<String, Entry> = env
            .storage()
            .persistent()
            .get(&STORE)
            .unwrap_or(Map::new(&env));

        store.get(key.clone()).ok_or(StorageError::KeyNotFound)
    }

    // ─────────────────────────────────────────
    //  UPDATE: overwrite an existing value
    // ─────────────────────────────────────────

    /// Update the value for an existing key.
    /// Only the original owner can update their own entry.
    pub fn update(
        env: Env,
        owner: Address,
        key: String,
        new_value: String,
    ) -> Result<(), StorageError> {
        owner.require_auth();

        if new_value.len() > 256 {
            return Err(StorageError::ValueTooLong);
        }

        let mut store: Map<String, Entry> = env
            .storage()
            .persistent()
            .get(&STORE)
            .unwrap_or(Map::new(&env));

        let mut entry = store.get(key.clone()).ok_or(StorageError::KeyNotFound)?;

        // Only the original owner may update
        if entry.owner != owner {
            return Err(StorageError::Unauthorized);
        }

        entry.value = new_value;
        entry.timestamp = env.ledger().timestamp();
        store.set(key.clone(), entry);
        env.storage().persistent().set(&STORE, &store);

        log!(&env, "update: key={}", key);
        Ok(())
    }

    // ─────────────────────────────────────────
    //  DELETE: remove an entry
    // ─────────────────────────────────────────

    /// Delete an entry by key.
    /// Only the original owner can delete their own entry.
    pub fn delete(
        env: Env,
        owner: Address,
        key: String,
    ) -> Result<(), StorageError> {
        owner.require_auth();

        let mut store: Map<String, Entry> = env
            .storage()
            .persistent()
            .get(&STORE)
            .unwrap_or(Map::new(&env));

        let entry = store.get(key.clone()).ok_or(StorageError::KeyNotFound)?;

        if entry.owner != owner {
            return Err(StorageError::Unauthorized);
        }

        store.remove(key.clone());
        env.storage().persistent().set(&STORE, &store);

        // Remove from the key index
        let mut keys: Vec<String> = env
            .storage()
            .persistent()
            .get(&KEYS)
            .unwrap_or(Vec::new(&env));

        // Rebuild the index without this key
        let mut new_keys: Vec<String> = Vec::new(&env);
        for k in keys.iter() {
            if k != key {
                new_keys.push_back(k);
            }
        }
        env.storage().persistent().set(&KEYS, &new_keys);

        log!(&env, "delete: key={}", key);
        Ok(())
    }

    // ─────────────────────────────────────────
    //  LIST: return all stored keys
    // ─────────────────────────────────────────

    /// Return a list of all keys currently in storage.
    /// Read-only — no authorisation required.
    pub fn list_keys(env: Env) -> Vec<String> {
        env.storage()
            .persistent()
            .get(&KEYS)
            .unwrap_or(Vec::new(&env))
    }

    // ─────────────────────────────────────────
    //  HAS: check if a key exists
    // ─────────────────────────────────────────

    /// Returns true if the key exists in storage.
    pub fn has(env: Env, key: String) -> bool {
        let store: Map<String, Entry> = env
            .storage()
            .persistent()
            .get(&STORE)
            .unwrap_or(Map::new(&env));
        store.contains_key(key)
    }

    // ─────────────────────────────────────────
    //  COUNT: total entries stored
    // ─────────────────────────────────────────

    /// Returns the total number of entries in storage.
    pub fn count(env: Env) -> u32 {
        let keys: Vec<String> = env
            .storage()
            .persistent()
            .get(&KEYS)
            .unwrap_or(Vec::new(&env));
        keys.len()
    }
}

// ─────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

    fn setup() -> (Env, Address, StorageContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, StorageContract);
        let client = StorageContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        (env, owner, client)
    }

    #[test]
    fn test_set_and_get() {
        let (env, owner, client) = setup();
        let key = String::from_str(&env, "hello");
        let val = String::from_str(&env, "world");

        client.set(&owner, &key, &val);
        let entry = client.get(&key);

        assert_eq!(entry.value, val);
        assert_eq!(entry.owner, owner);
    }

    #[test]
    fn test_update() {
        let (env, owner, client) = setup();
        let key = String::from_str(&env, "foo");

        client.set(&owner, &key, &String::from_str(&env, "bar"));
        client.update(&owner, &key, &String::from_str(&env, "baz"));

        let entry = client.get(&key);
        assert_eq!(entry.value, String::from_str(&env, "baz"));
    }

    #[test]
    fn test_delete() {
        let (env, owner, client) = setup();
        let key = String::from_str(&env, "temp");

        client.set(&owner, &key, &String::from_str(&env, "data"));
        assert_eq!(client.has(&key), true);

        client.delete(&owner, &key);
        assert_eq!(client.has(&key), false);
    }

    #[test]
    fn test_list_keys_and_count() {
        let (env, owner, client) = setup();

        client.set(&owner, &String::from_str(&env, "k1"), &String::from_str(&env, "v1"));
        client.set(&owner, &String::from_str(&env, "k2"), &String::from_str(&env, "v2"));
        client.set(&owner, &String::from_str(&env, "k3"), &String::from_str(&env, "v3"));

        assert_eq!(client.count(), 3);
        assert_eq!(client.list_keys().len(), 3);
    }

    #[test]
    #[should_panic]
    fn test_duplicate_key_rejected() {
        let (env, owner, client) = setup();
        let key = String::from_str(&env, "dup");
        let val = String::from_str(&env, "v");

        client.set(&owner, &key, &val);
        client.set(&owner, &key, &val); // should panic
    }

    #[test]
    #[should_panic]
    fn test_unauthorized_update_rejected() {
        let (env, owner, client) = setup();
        let attacker = Address::generate(&env);
        let key = String::from_str(&env, "secret");

        client.set(&owner, &key, &String::from_str(&env, "my-data"));
        client.update(&attacker, &key, &String::from_str(&env, "hacked")); // should panic
    }
}